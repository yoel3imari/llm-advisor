//! High-performance localhost Axum reverse proxy gateway bridging external OpenAI clients
//! to the internal llama-server inference sidecar with zero-buffering SSE streaming.

use axum::body::Body;
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
            "model": model,
            "internal_port": port
        })),
    )
}

/// GET /v1/models
async fn models_handler(State(state): State<Arc<GatewayState>>) -> impl IntoResponse {
    if let Some(model_id) = state.server_manager.get_active_model_id() {
        Json(json!({
            "object": "list",
            "data": [
                {
                    "id": model_id,
                    "object": "model",
                    "created": 1700000000,
                    "owned_by": "local-llm-advisor"
                }
            ]
        }))
    } else {
        Json(json!({
            "object": "list",
            "data": []
        }))
    }
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

/// Internal relay helper with streaming body forwarding.
async fn proxy_to_sidecar(
    state: Arc<GatewayState>,
    req: Request<Body>,
    target_path: &str,
) -> Response<Body> {
    let internal_port = match state.server_manager.get_active_port() {
        Some(p) => p,
        None => return server_not_serving_503(),
    };

    let target_uri = format!("http://127.0.0.1:{}{}", internal_port, target_path);
    let (parts, body) = req.into_parts();

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

    // Convert axum body stream to reqwest body stream
    let data_stream = body
        .into_data_stream()
        .map(|res| res.map_err(std::io::Error::other));
    upstream_req = upstream_req.body(reqwest::Body::wrap_stream(data_stream));

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
