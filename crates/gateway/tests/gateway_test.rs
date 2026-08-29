use gateway::*;
use reqwest::StatusCode;
use serde_json::{json, Value};
use server_manager::*;
use std::fs::File;
use std::io::Write;
use std::sync::Arc;
use tempfile::tempdir;

#[tokio::test]
async fn test_gateway_idle_and_endpoints() {
    let dir = tempdir().unwrap();
    let dummy_sidecar = dir.path().join("dummy-sidecar");
    {
        let mut f = File::create(&dummy_sidecar).unwrap();
        f.write_all(b"").unwrap();
    }

    let manager = Arc::new(ServerManager::new(dummy_sidecar));
    let (gateway_port, _handle) = start_gateway(manager.clone(), 19370)
        .await
        .expect("start gateway");

    let client = reqwest::Client::new();
    let base_url = format!("http://127.0.0.1:{}", gateway_port);

    // 1. GET /healthz
    let resp = client
        .get(format!("{}/healthz", base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let health: Value = resp.json().await.unwrap();
    assert_eq!(health["state"], "stopped");

    // 2. GET /v1/models when stopped
    let resp = client
        .get(format!("{}/v1/models", base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let models: Value = resp.json().await.unwrap();
    assert_eq!(models["data"].as_array().unwrap().len(), 0);

    // 3. POST /v1/chat/completions when idle -> returns structured 503
    let chat_req = json!({
        "model": "test",
        "messages": [{"role": "user", "content": "hi"}]
    });
    let resp = client
        .post(format!("{}/v1/chat/completions", base_url))
        .json(&chat_req)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    let err_body: Value = resp.json().await.unwrap();
    assert_eq!(err_body["error"]["code"], 503);
    assert_eq!(err_body["error"]["type"], "server_not_running");

    // 4. Fallback 404
    let resp = client
        .get(format!("{}/not_found_endpoint", base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    let err404: Value = resp.json().await.unwrap();
    assert_eq!(err404["error"]["code"], 404);
}

#[tokio::test]
async fn test_gateway_port_collision_strict_fail() {
    let dir = tempdir().unwrap();
    let dummy_sidecar = dir.path().join("dummy-sidecar-2");
    {
        let mut f = File::create(&dummy_sidecar).unwrap();
        f.write_all(b"").unwrap();
    }

    let manager = Arc::new(ServerManager::new(dummy_sidecar));
    let (port, _handle1) = start_gateway(manager.clone(), 19375)
        .await
        .expect("start first gateway");

    // Attempting to bind same port must fail strictly with ServerPortBind error
    let second_res = start_gateway(manager, port).await;
    assert!(second_res.is_err());
    match second_res.err().unwrap() {
        domain::AppError::ServerPortBind(msg) => {
            assert!(msg.contains("19375"));
        }
        other => panic!("Expected ServerPortBind error, got {:?}", other),
    }
}

#[tokio::test]
async fn test_gateway_multi_model_routing() {
    let dir = tempdir().unwrap();

    let fake_server_path = dir.path().join("fake-route-server.py");
    let script_content = r#"#!/usr/bin/env python3
import sys, http.server, socketserver, argparse

parser = argparse.ArgumentParser()
parser.add_argument("-m", type=str)
parser.add_argument("--port", type=int, default=18080)
parser.add_argument("--host", type=str, default="127.0.0.1")
parser.add_argument("-c", type=int)
parser.add_argument("-np", type=int)
parser.add_argument("-ctk", type=str)
parser.add_argument("-ctv", type=str)
parser.add_argument("-ngl", type=int)

args, _ = parser.parse_known_args()

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        resp = f'{{"choices": [{{"message": {{"role": "assistant", "content": "from port {args.port}"}}}}], "model": "{args.m}"}}'
        self.wfile.write(resp.encode("utf-8"))

    def log_message(self, format, *args):
        pass

with socketserver.TCPServer((args.host, args.port), Handler) as httpd:
    httpd.serve_forever()
"#;

    {
        let mut f = File::create(&fake_server_path).unwrap();
        f.write_all(script_content.as_bytes()).unwrap();
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&fake_server_path).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&fake_server_path, perms).unwrap();
    }

    let m1_path = dir.path().join("model1.gguf");
    let m2_path = dir.path().join("model2.gguf");
    {
        let mut f1 = File::create(&m1_path).unwrap();
        f1.write_all(b"M1").unwrap();
        let mut f2 = File::create(&m2_path).unwrap();
        f2.write_all(b"M2").unwrap();
    }

    let manager = Arc::new(ServerManager::new(fake_server_path));
    let _port1 = manager
        .start_server("smollm2-135m".to_string(), m1_path, domain::ServeConfig::default(), None)
        .await
        .expect("start smollm2");

    let _port2 = manager
        .start_server("qwen2.5-coder".to_string(), m2_path, domain::ServeConfig::default(), None)
        .await
        .expect("start qwen2.5");

    let (gateway_port, _handle) = start_gateway(manager.clone(), 19380)
        .await
        .expect("start gateway");

    let client = reqwest::Client::new();
    let base_url = format!("http://127.0.0.1:{}", gateway_port);

    // 1. Check GET /v1/models returns both models
    let resp = client
        .get(format!("{}/v1/models", base_url))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let models_body: Value = resp.json().await.unwrap();
    let model_list = models_body["data"].as_array().unwrap();
    assert_eq!(model_list.len(), 2);

    // 2. Request targeting smollm2
    let req1 = json!({
        "model": "smollm2-135m",
        "messages": [{"role": "user", "content": "hi"}]
    });
    let resp1 = client
        .post(format!("{}/v1/chat/completions", base_url))
        .json(&req1)
        .send()
        .await
        .unwrap();
    assert_eq!(resp1.status(), StatusCode::OK);
    let body1: Value = resp1.json().await.unwrap();
    assert!(body1["model"].as_str().unwrap().contains("model1.gguf"));

    // 3. Request targeting qwen2.5
    let req2 = json!({
        "model": "qwen2.5-coder",
        "messages": [{"role": "user", "content": "hi"}]
    });
    let resp2 = client
        .post(format!("{}/v1/chat/completions", base_url))
        .json(&req2)
        .send()
        .await
        .unwrap();
    assert_eq!(resp2.status(), StatusCode::OK);
    let body2: Value = resp2.json().await.unwrap();
    assert!(body2["model"].as_str().unwrap().contains("model2.gguf"));

    // 4. Request for non-loaded model -> returns 404
    let req_unknown = json!({
        "model": "llama-70b-unknown",
        "messages": [{"role": "user", "content": "hi"}]
    });
    let resp_unk = client
        .post(format!("{}/v1/chat/completions", base_url))
        .json(&req_unknown)
        .send()
        .await
        .unwrap();
    assert_eq!(resp_unk.status(), StatusCode::NOT_FOUND);

    // Clean up
    manager.stop_all().await.unwrap();
}
