//! High-performance localhost Axum reverse proxy gateway bridging external OpenAI clients
//! to the internal llama-server inference sidecars with zero-buffering SSE streaming and multi-model routing.

use axum::body::{to_bytes, Body};
use axum::extract::State;
use axum::http::{Method, Request, Response, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use domain::AppError;
use futures_util::StreamExt;
use serde_json::json;
use server_manager::{ServerManager, ServerState};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

/// Shared state for the gateway router.
pub struct GatewayState {
    pub server_manager: Arc<ServerManager>,
}

/// Start the Axum gateway listening on localhost (starting at preferred_port, default 13370).
pub async fn start_gateway(
    server_manager: Arc<ServerManager>,
    preferred_port: u16,
) -> Result<(u16, tokio::task::JoinHandle<()>), AppError> {
    let state = Arc::new(GatewayState { server_manager });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let app = Router::new()
        .route("/healthz", get(healthz_handler))
        .route("/v1/models", get(models_handler))
        .route("/v1/chat/completions", post(proxy_chat_completions))
        .route("/v1/completions", post(proxy_completions))
        .fallback(not_found_handler)
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], preferred_port));
    let listener = TcpListener::bind(addr).await.map_err(|e| {
        AppError::ServerPortBind(format!(
            "Port {} is already in use: {}. Please free the port or change gateway_port in Settings.",
            preferred_port, e
        ))
    })?;
    let port = preferred_port;

    info!("Gateway bound to http://127.0.0.1:{}", port);

    let handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            error!("Gateway server error: {}", e);
        }
    });

    Ok((port, handle))
}

/// GET /healthz
async fn healthz_handler(State(state): State<Arc<GatewayState>>) -> impl IntoResponse {
    let server_state = state.server_manager.get_state();
    let model = state.server_manager.get_active_model_id();
    let port = state.server_manager.get_active_port();
    let instances = state.server_manager.list_instances();

    let state_str = match server_state {
        ServerState::Stopped => "stopped",
        ServerState::Starting { .. } => "starting",
        ServerState::Serving { .. } => "serving",
        ServerState::Error { .. } => "error",
    };

    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "state": state_str,
            "primary_model": model,
            "internal_port": port,
            "instances": instances
        })),
    )
}

/// GET /v1/models (Returns all running model instances)
async fn models_handler(State(state): State<Arc<GatewayState>>) -> impl IntoResponse {
    let running_instances = state.server_manager.list_instances();
    let models_data: Vec<serde_json::Value> = running_instances
        .into_iter()
        .map(|inst| {
            json!({
                "id": inst.model_id,
                "object": "model",
                "created": inst.started_at.timestamp(),
                "owned_by": "llm-advisor",
                "port": inst.port,
                "context_size": inst.context_size
            })
        })
        .collect();

    Json(json!({
        "object": "list",
        "data": models_data
    }))
}

/// OpenAI 503 error envelope response.
fn server_not_serving_503() -> Response<Body> {
    let body_json = json!({
        "error": {
            "message": "No model is being served. Start one from the app.",
            "type": "server_not_running",
            "code": 503
        }
    });
    Response::builder()
        .status(StatusCode::SERVICE_UNAVAILABLE)
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&body_json).unwrap()))
        .unwrap()
}

/// Model not loaded 404 response.
fn model_not_found_404(requested: &str, available: &[String]) -> Response<Body> {
    let body_json = json!({
        "error": {
            "message": format!(
                "Model '{}' is not currently loaded. Loaded models in pool: {:?}",
                requested, available
            ),
            "type": "model_not_found",
            "code": 404
        }
    });
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&body_json).unwrap()))
        .unwrap()
}

/// Fallback 404 handler.
async fn not_found_handler() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(json!({
            "error": {
                "message": "The requested endpoint was not found.",
                "type": "invalid_request_error",
                "code": 404
            }
        })),
    )
}

/// POST /v1/chat/completions (Zero-buffering SSE streaming & non-streaming relay)
async fn proxy_chat_completions(
    State(state): State<Arc<GatewayState>>,
    req: Request<Body>,
) -> Response<Body> {
    proxy_to_sidecar(state, req, "/v1/chat/completions").await
}

/// POST /v1/completions
async fn proxy_completions(
    State(state): State<Arc<GatewayState>>,
    req: Request<Body>,
) -> Response<Body> {
    proxy_to_sidecar(state, req, "/v1/completions").await
}

/// Internal relay helper with streaming body forwarding and model routing.
async fn proxy_to_sidecar(
    state: Arc<GatewayState>,
    req: Request<Body>,
    target_path: &str,
) -> Response<Body> {
    let running_models = state.server_manager.get_running_model_ids();
    if running_models.is_empty() {
        return server_not_serving_503();
    }

    let (parts, body) = req.into_parts();

    // Buffer incoming request body (up to 16MB) to inspect requested model
    let body_bytes = match to_bytes(body, 16 * 1024 * 1024).await {
        Ok(b) => b,
        Err(e) => {
            let err_json = json!({
                "error": {
                    "message": format!("Failed to read request body: {}", e),
                    "type": "invalid_request_error",
                    "code": 400
                }
            });
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&err_json).unwrap()))
                .unwrap();
        }
    };

    // Extract requested "model" field if present
    let requested_model = serde_json::from_slice::<serde_json::Value>(&body_bytes)
        .ok()
        .and_then(|v| {
            v.get("model")
                .and_then(|m| m.as_str().map(|s| s.to_string()))
        });

    let target_port = match state
        .server_manager
        .get_port_for_model(requested_model.as_deref())
    {
        Some(p) => p,
        None => {
            let req_name = requested_model.as_deref().unwrap_or("unknown");
            return model_not_found_404(req_name, &running_models);
        }
    };

    let target_uri = format!("http://127.0.0.1:{}{}", target_port, target_path);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let mut upstream_req = client.post(&target_uri);

    // Forward relevant headers
    for (name, val) in parts.headers.iter() {
        if name != "host" && name != "content-length" {
            upstream_req = upstream_req.header(name, val);
        }
    }

    upstream_req = upstream_req.body(body_bytes);

    match upstream_req.send().await {
        Ok(upstream_resp) => {
            let status = StatusCode::from_u16(upstream_resp.status().as_u16())
                .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

            let mut builder = Response::builder().status(status);
            for (k, v) in upstream_resp.headers() {
                builder = builder.header(k.as_str(), v.as_bytes());
            }

            let stream = upstream_resp
                .bytes_stream()
                .map(|res| res.map_err(std::io::Error::other));
            let body = Body::from_stream(stream);

            builder.body(body).unwrap_or_else(|_| {
                Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(Body::empty())
                    .unwrap()
            })
        }
        Err(e) => {
            let err_json = json!({
                "error": {
                    "message": format!("Upstream inference server error: {}", e),
                    "type": "upstream_error",
                    "code": 502
                }
            });
            Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&err_json).unwrap()))
                .unwrap()
        }
    }
}
