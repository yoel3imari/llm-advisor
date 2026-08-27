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
