use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use tauri::{ipc::Channel, State};
use tracing::warn;

use crate::AppState;

fn default_stream() -> bool {
    true
}

fn default_temperature() -> f64 {
    0.7
}

fn default_max_tokens() -> u32 {
    2048
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatStreamRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    pub temperature: f64,
    pub max_tokens: u32,
}

impl<'de> Deserialize<'de> for ChatStreamRequest {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct RawRequest {
            model: String,
            messages: Vec<ChatMessage>,
            #[serde(default = "default_stream")]
            stream: bool,
            #[serde(default = "default_temperature")]
            temperature: f64,
            max_tokens: Option<u32>,
            #[serde(rename = "maxTokens")]
            max_tokens_camel: Option<u32>,
        }

        let raw = RawRequest::deserialize(deserializer)?;
        let max_tokens = raw
            .max_tokens_camel
            .or(raw.max_tokens)
            .unwrap_or_else(default_max_tokens);

        Ok(ChatStreamRequest {
            model: raw.model,
            messages: raw.messages,
            stream: raw.stream,
            temperature: raw.temperature,
            max_tokens,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatEvent {
    #[serde(rename = "token")]
    Token { delta: String },
    #[serde(rename = "done")]
    Done,
    #[serde(rename = "error")]
    Error { code: String, message: String },
}

pub struct ChatSessionManager {
    next_id: AtomicU64,
    active: Mutex<HashMap<String, tokio::task::JoinHandle<()>>>,
}

impl Default for ChatSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ChatSessionManager {
    pub fn new() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            active: Mutex::new(HashMap::new()),
        }
    }

    fn alloc_id(&self) -> String {
        format!("chat-{}", self.next_id.fetch_add(1, Ordering::SeqCst))
    }

    fn register(&self, session_id: String, handle: tokio::task::JoinHandle<()>) {
        self.active.lock().unwrap().insert(session_id, handle);
    }

    pub fn cancel(&self, session_id: &str) -> bool {
        if let Some(handle) = self.active.lock().unwrap().remove(session_id) {
            handle.abort();
            true
        } else {
            false
        }
    }

    fn remove(&self, session_id: &str) {
        self.active.lock().unwrap().remove(session_id);
    }
}

fn parse_sse_line(line: &str) -> Option<ChatEvent> {
    let line = line.trim();
    if line.is_empty() || line.starts_with(':') {
        return None;
    }

    let data = line.strip_prefix("data:")?.trim();
    if data == "[DONE]" {
        // eprintln!("[DEBUG Rust parse_sse_line] Received [DONE]");
        return Some(ChatEvent::Done);
    }

    let obj: serde_json::Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_e) => {
            // eprintln!("[DEBUG Rust parse_sse_line] Failed to parse JSON from SSE data: '{}' err={}", data, _e);
            return None;
        }
    };

    if let Some(err_val) = obj.get("error") {
        // eprintln!("[DEBUG Rust parse_sse_line-ERROR] Upstream returned error in SSE: {:?}", err_val);
        let msg = err_val
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Upstream error in SSE");
        let code = err_val
            .get("code")
            .and_then(|c| c.as_str())
            .unwrap_or("UPSTREAM_ERROR");
        return Some(ChatEvent::Error {
            code: code.to_string(),
            message: msg.to_string(),
        });
    }

    let content = obj
        .get("choices")?
        .as_array()?
        .first()?
        .get("delta")?
        .get("content")?
        .as_str()?;
    if content.is_empty() {
        return None;
    }
    Some(ChatEvent::Token {
        delta: content.to_string(),
    })
}

fn drain_complete_lines(buffer: &mut String) -> Vec<String> {
    let mut lines = Vec::new();
    while let Some(pos) = buffer.find('\n') {
        lines.push(buffer[..pos].to_string());
        *buffer = buffer[pos + 1..].to_string();
    }
    lines
}

async fn proxy_stream(
    request: ChatStreamRequest,
    channel: Channel<ChatEvent>,
    gateway_port: u16,
) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{}/v1/chat/completions", gateway_port);
    let body = serde_json::json!({
        "model": request.model,
        "messages": request.messages,
        "stream": true,
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
    });
    // eprintln!("[DEBUG Rust proxy_stream] 5a. Prepared proxy request to URL={}, body={}", url, body);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    // eprintln!("[DEBUG Rust proxy_stream] 5b. Sending POST to gateway...");
    let resp = match client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await
    {
        Ok(r) => {
            // eprintln!("[DEBUG Rust proxy_stream] 5c. Gateway responded with status: {}", r.status());
            r
        }
        Err(e) => {
            // eprintln!("[DEBUG Rust proxy_stream-ERROR] reqwest send failed: {}", e);
            let code = if e.is_connect() { "NO_MODEL" } else { "STREAM_ERROR" };
            let _ = channel.send(ChatEvent::Error {
                code: code.to_string(),
                message: e.to_string(),
            });
            return Err(e.to_string());
        }
    };

    if resp.status().as_u16() == 503 {
        // eprintln!("[DEBUG Rust proxy_stream] Gateway 503 NO_MODEL");
        let _ = channel.send(ChatEvent::Error {
            code: "NO_MODEL".to_string(),
            message: "No model serving — select and Start".to_string(),
        });
        return Ok(());
    }

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let err_text = resp.text().await.unwrap_or_default();
        // eprintln!("[DEBUG Rust proxy_stream-ERROR] Gateway returned non-success: status={}, body={}", status, err_text);
        let _ = channel.send(ChatEvent::Error {
            code: "UPSTREAM_ERROR".to_string(),
            message: format!("Gateway returned status {}: {}", status, err_text),
        });
        return Ok(());
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(bytes) => bytes,
            Err(e) => {
                // eprintln!("[DEBUG Rust proxy_stream-ERROR] Stream error: {}", e);
                let _ = channel.send(ChatEvent::Error {
                    code: "SIDECAR_DIED".to_string(),
                    message: format!("Upstream stream ended: {}", e),
                });
                return Ok(());
            }
        };
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        for line in drain_complete_lines(&mut buffer) {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with(':') {
                continue;
            }
            // eprintln!("[DEBUG Rust proxy_stream] SSE line: {}", trimmed);
            match parse_sse_line(&line) {
                Some(ChatEvent::Done) => {
                    // eprintln!("[DEBUG Rust proxy_stream] Forwarding Done event");
                    let _ = channel.send(ChatEvent::Done);
                    return Ok(());
                }
                Some(event) => {
                    let _ = channel.send(event);
                }
                None => {
                    warn!("chat_stream: skipping unhandled SSE line: {}", trimmed);
                }
            }
        }
    }

    if !buffer.trim().is_empty() {
        if let Some(event) = parse_sse_line(&buffer) {
            let _ = channel.send(event);
        }
    }

    // eprintln!("[DEBUG Rust proxy_stream] Stream loop ended normally");
    Ok(())
}

#[tauri::command]
pub async fn chat_stream(
    request: ChatStreamRequest,
    channel: Channel<ChatEvent>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // eprintln!(
    //     "[DEBUG Rust chat_stream command] ENTERED: model='{}', messages_count={}, stream={}, temperature={}, max_tokens={}",
    //     request.model,
    //     request.messages.len(),
    //     request.stream,
    //     request.temperature,
    //     request.max_tokens
    // );
    let gateway_port = state
        .settings
        .read()
        .map(|s| s.gateway_port)
        .unwrap_or(13370);
    let manager = state.chat_sessions.clone();
    let task_manager = manager.clone();
    let session_id = manager.alloc_id();
    let cleanup_id = session_id.clone();

    let handle = tokio::spawn(async move {
        if let Err(message) = proxy_stream(request, channel.clone(), gateway_port).await {
            // eprintln!("[DEBUG Rust chat_stream task-ERROR] proxy_stream returned error: {}", message);
            let _ = channel.send(ChatEvent::Error {
                code: "STREAM_ERROR".to_string(),
                message,
            });
        }
        task_manager.remove(&cleanup_id);
    });
    manager.register(session_id.clone(), handle);

    // eprintln!("[DEBUG Rust chat_stream command] session registered: {}", session_id);
    Ok(session_id)
}

#[tauri::command]
pub async fn chat_cancel(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.chat_sessions.cancel(&session_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_token_delta() {
        let line = r#"data: {"choices":[{"delta":{"content":"Hello"}}]}"#;
        match parse_sse_line(line) {
            Some(ChatEvent::Token { delta }) => assert_eq!(delta, "Hello"),
            _ => panic!("expected token"),
        }
    }

    #[test]
    fn parses_done_marker() {
        assert!(matches!(parse_sse_line("data: [DONE]"), Some(ChatEvent::Done)));
    }

    #[test]
    fn ignores_empty_and_comment_lines() {
        assert!(parse_sse_line("").is_none());
        assert!(parse_sse_line(": keep-alive").is_none());
    }

    #[test]
    fn skips_malformed_payload_without_panic() {
        assert!(parse_sse_line("data: {not json").is_none());
        assert!(parse_sse_line("data: {\"choices\":[]}").is_none());
        assert!(parse_sse_line("event: message").is_none());
    }

    #[test]
    fn token_split_across_two_chunks_reassembles() {
        let mut buffer = String::new();
        buffer.push_str("data: {\"choices\":[{\"delta\":{\"content\":\"Hel");
        assert!(drain_complete_lines(&mut buffer).is_empty());

        buffer.push_str("lo\"}}]}\n");
        let lines = drain_complete_lines(&mut buffer);
        assert_eq!(lines.len(), 1);
        match parse_sse_line(&lines[0]) {
            Some(ChatEvent::Token { delta }) => assert_eq!(delta, "Hello"),
            _ => panic!("expected reassembled token"),
        }
        assert!(buffer.is_empty());
    }

    #[test]
    fn deserializes_request_with_camel_case_or_snake_case_max_tokens() {
        let json_camel = r#"{
            "model": "qwen2.5-coder",
            "messages": [{"role": "user", "content": "hi"}],
            "stream": true,
            "temperature": 0.7,
            "maxTokens": 4096
        }"#;
        let req_camel: ChatStreamRequest = serde_json::from_str(json_camel).unwrap();
        assert_eq!(req_camel.max_tokens, 4096);

        let json_snake = r#"{
            "model": "qwen2.5-coder",
            "messages": [{"role": "user", "content": "hi"}],
            "stream": true,
            "temperature": 0.5,
            "max_tokens": 1024
        }"#;
        let req_snake: ChatStreamRequest = serde_json::from_str(json_snake).unwrap();
        assert_eq!(req_snake.max_tokens, 1024);

        let json_defaults = r#"{
            "model": "qwen2.5-coder",
            "messages": []
        }"#;
        let req_defaults: ChatStreamRequest = serde_json::from_str(json_defaults).unwrap();
        assert!(req_defaults.stream);
        assert_eq!(req_defaults.temperature, 0.7);
        assert_eq!(req_defaults.max_tokens, 2048);

        let json_both = r#"{
            "model": "qwen2.5-coder",
            "messages": [{"role": "user", "content": "hi"}],
            "stream": true,
            "temperature": 0.7,
            "max_tokens": 1024,
            "maxTokens": 2048
        }"#;
        let req_both: ChatStreamRequest = serde_json::from_str(json_both).unwrap();
        assert_eq!(req_both.max_tokens, 2048);
    }
}

