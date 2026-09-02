use catalog::load_bundled_catalog;
use domain::{KvType, ModelRecord, ServeConfig};
use downloader::{download_model, DownloadOptions};
use fit_engine::evaluate;
use gateway::start_gateway;
use hw_probe::get_or_detect_profile;
use library::LibraryStore;
use serde_json::{json, Value};
use server_manager::ServerManager;
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::tempdir;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("============================================================");
    println!("  LLM Advisor — END-TO-END AUTOMATED QA PIPELINE");
    println!("============================================================");

    // Step 1: Detect Hardware
    println!("\n[1/7] Probing Hardware Profile...");
    let profile = get_or_detect_profile()?;
    println!(
        "  CPU: {} ({} physical cores)",
        profile.cpu_name, profile.cpu_physical_cores
    );
    println!(
        "  Host RAM: {:.2} GB (Metal working-set ceiling: {:.2} GB)",
        profile.total_ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0),
        profile.metal_working_set_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
    );

    // Step 2: Evaluate Fit on Catalog
    println!("\n[2/7] Loading Model Catalog & Evaluating Fit Engine...");
    let catalog = load_bundled_catalog()?;
    println!("  Loaded {} catalog entries.", catalog.len());

    let target_entry = catalog
        .iter()
        .find(|e| e.id == "qwen2.5-0.5b-instruct-q4_k_m")
        .expect("Target model not found in catalog");

    let serve_cfg = ServeConfig {
        context_size: 2048,
        n_parallel: 1,
        kv_type: KvType::F16,
        n_gpu_layers: None,
    };

    let fit = evaluate(&profile, target_entry, &serve_cfg);
    println!("  Target Model: {}", target_entry.id);
    println!(
        "  Fit Verdict: fits={}, est_total={:.2} GB, speed=~{:.1} tok/s",
        fit.fits,
        fit.est_total_bytes as f64 / (1024.0 * 1024.0 * 1024.0),
        fit.speed_tps_estimate
    );
    assert!(fit.fits, "Target model must fit into hardware budget");

    // Step 3: Acquire & Verify GGUF Model
    let temp_dir = tempdir()?;
    let library = LibraryStore::new(temp_dir.path().to_path_buf())?;
    println!(
        "\n[3/7] Downloading & Verifying GGUF ({:.2} MB)...",
        target_entry.file_size_bytes as f64 / (1024.0 * 1024.0)
    );

    let download_opts = DownloadOptions {
        entry: target_entry.clone(),
        destination_dir: library.models_dir().to_path_buf(),
        hf_token: None,
        base_url_override: None,
        cancel_token: None,
        on_progress: Some(Arc::new(|done, total| {
            let pct = (done as f64 / total as f64) * 100.0;
            if (done % (25 * 1024 * 1024)) < 2 * 1024 * 1024 || done == total {
                print!(
                    "\r  Progress: {:.1}% ({:.1}/{:.1} MB)",
                    pct,
                    done as f64 / (1024.0 * 1024.0),
                    total as f64 / (1024.0 * 1024.0)
                );
                std::io::Write::flush(&mut std::io::stdout()).unwrap();
            }
        })),
    };

    let downloaded_path = download_model(download_opts).await?;
    println!(
        "\n  Download complete & verified SHA256: {:?}",
        downloaded_path
    );

    let record = ModelRecord {
        entry_id: target_entry.id.clone(),
        file_path: downloaded_path.clone(),
        size_bytes: target_entry.file_size_bytes,
        verified: true,
        added_at: chrono::Utc::now(),
    };
    library.add_verified(record)?;

    // Step 4: Provision & Spawn llama-server Sidecar
    println!("\n[4/7] Spawning llama-server Sidecar...");
    let sidecar_path = PathBuf::from("sidecars/binaries/llama-server");
    assert!(
        sidecar_path.exists(),
        "Sidecar must exist at {:?}",
        sidecar_path
    );

    let server_mgr = Arc::new(ServerManager::new(sidecar_path));
    let internal_port = server_mgr
        .start_server(
            target_entry.id.clone(),
            downloaded_path,
            serve_cfg.clone(),
            Some(fit),
        )
        .await?;

    println!(
        "  llama-server healthy and serving on internal port :{}",
        internal_port
    );

    // Step 5: Launch Axum Gateway on 127.0.0.1:13370
    println!("\n[5/7] Starting Axum Gateway on 127.0.0.1:13370...");
    let (gateway_port, _gateway_handle) = start_gateway(server_mgr.clone(), 13370).await?;
    println!("  Gateway online at http://127.0.0.1:{}", gateway_port);

    let client = reqwest::Client::new();
    let base_url = format!("http://127.0.0.1:{}", gateway_port);

    // Step 6: Test Gateway Endpoints & SSE Streaming
    println!("\n[6/7] Testing Gateway API & SSE Streaming Completions...");

    // 6a: GET /v1/models
    let models_resp: Value = client
        .get(format!("{}/v1/models", base_url))
        .send()
        .await?
        .json()
        .await?;
    println!("  GET /v1/models -> {}", models_resp);
    assert_eq!(models_resp["data"][0]["id"], target_entry.id);

    // 6b: Non-streaming POST /v1/chat/completions
    println!("  Testing non-stream POST /v1/chat/completions...");
    let non_stream_req = json!({
        "model": target_entry.id,
        "messages": [
            {"role": "system", "content": "You are a concise AI assistant."},
            {"role": "user", "content": "What is 2 + 2? Reply with just the number."}
        ],
        "temperature": 0.0,
        "max_tokens": 10
    });

    let resp = client
        .post(format!("{}/v1/chat/completions", base_url))
        .json(&non_stream_req)
        .send()
        .await?;

    assert_eq!(resp.status(), reqwest::StatusCode::OK);
    let chat_result: Value = resp.json().await?;
    let content = chat_result["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or_default()
        .trim();
    println!("  Completion Response: \"{}\"", content);
    assert!(!content.is_empty(), "Completion content must not be empty");

    // 6c: Zero-buffering SSE Streaming POST /v1/chat/completions
    println!("  Testing zero-buffering SSE streaming POST /v1/chat/completions...");
    let stream_req = json!({
        "model": target_entry.id,
        "messages": [
            {"role": "user", "content": "Count from 1 to 5 separated by spaces."}
        ],
        "temperature": 0.0,
        "max_tokens": 20,
        "stream": true
    });

    let mut stream_resp = client
        .post(format!("{}/v1/chat/completions", base_url))
        .json(&stream_req)
        .send()
        .await?;

    assert_eq!(stream_resp.status(), reqwest::StatusCode::OK);
    println!("  Streaming chunks received:");
    let mut full_streamed_text = String::new();
    let mut chunk_count = 0;

    while let Some(chunk_res) = stream_resp.chunk().await? {
        let text = String::from_utf8_lossy(&chunk_res);
        for line in text.lines() {
            if line.starts_with("data: ") && !line.contains("[DONE]") {
                if let Ok(json_val) = serde_json::from_str::<Value>(&line[6..]) {
                    if let Some(delta) = json_val["choices"][0]["delta"]["content"].as_str() {
                        print!("{}", delta);
                        full_streamed_text.push_str(delta);
                        chunk_count += 1;
                        std::io::Write::flush(&mut std::io::stdout()).unwrap();
                    }
                }
            }
        }
    }
    println!("\n  Total streamed chunks: {}", chunk_count);
    assert!(chunk_count > 0, "Must receive streamed token chunks");

    // Step 7: Graceful Teardown & Idle 503 Verification
    println!("\n[7/7] Verifying Server Teardown & Idle 503 Semantics...");
    server_mgr.stop_server().await?;
    println!("  Server stopped.");

    let idle_resp = client
        .post(format!("{}/v1/chat/completions", base_url))
        .json(&non_stream_req)
        .send()
        .await?;

    assert_eq!(idle_resp.status(), reqwest::StatusCode::SERVICE_UNAVAILABLE);
    let idle_json: Value = idle_resp.json().await?;
    println!("  Idle response: {}", idle_json);
    assert_eq!(idle_json["error"]["code"], 503);

    println!("\n============================================================");
    println!("  ALL E2E ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!");
    println!("============================================================");

    Ok(())
}
