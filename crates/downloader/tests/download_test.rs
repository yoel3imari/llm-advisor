use domain::{AppError, CatalogEntry};
use downloader::*;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tempfile::tempdir;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

fn calculate_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

#[tokio::test]
async fn test_happy_path_download_and_verify() {
    let mock_server = MockServer::start().await;
    let payload = b"GGUF_TEST_PAYLOAD_1234567890_HELLO_WORLD";
    let sha = calculate_sha256(payload);

    Mock::given(method("HEAD"))
        .and(path("/test-model.gguf"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_bytes(payload.to_vec())
                .insert_header("etag", format!("\"{}\"", sha).as_str()),
        )
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/test-model.gguf"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(payload.to_vec()))
        .mount(&mock_server)
        .await;

    let dir = tempdir().unwrap();
    let entry = CatalogEntry {
        id: "test-model".to_string(),
        repo_id: "org/test".to_string(),
        filename: "test-model.gguf".to_string(),
        family: "test".to_string(),
        params_billions: 1.0,
        active_params_b: None,
        n_layers: 16,
        n_kv_heads: 4,
        head_dim: 64,
        context_train: 2048,
        quant: "Q4_0".to_string(),
        file_size_bytes: payload.len() as u64,
        sha256: sha.clone(),
        gated: false,
        quality_tier: 4,
        tags: vec![],
    };

    let progress_recorded = Arc::new(AtomicU64::new(0));
    let progress_clone = progress_recorded.clone();
    let cb: ProgressCallback = Arc::new(move |done, _total| {
        progress_clone.store(done, Ordering::SeqCst);
    });

    let options = DownloadOptions {
        entry,
        destination_dir: dir.path().to_path_buf(),
        hf_token: None,
        base_url_override: Some(mock_server.uri()),
        cancel_token: None,
        on_progress: Some(cb),
    };

    let final_path = download_model(options)
        .await
        .expect("Download should succeed");
    assert!(final_path.exists());
    assert_eq!(final_path.file_name().unwrap(), "test-model.gguf");
    assert_eq!(
        progress_recorded.load(Ordering::SeqCst),
        payload.len() as u64
    );
}

#[tokio::test]
async fn test_resumable_range_download() {
    let mock_server = MockServer::start().await;
    let payload = b"FIRST_HALF_OF_BYTES_AND_SECOND_HALF_OF_BYTES";
    let sha = calculate_sha256(payload);

    let first_half = &payload[..20];
    let second_half = &payload[20..];

    Mock::given(method("HEAD"))
        .and(path("/resume-model.gguf"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(payload.to_vec()))
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/resume-model.gguf"))
        .and(header("range", "bytes=20-"))
        .respond_with(ResponseTemplate::new(206).set_body_bytes(second_half.to_vec()))
        .mount(&mock_server)
        .await;

    let dir = tempdir().unwrap();
    let part_file = dir.path().join("resume-model.part");
    tokio::fs::write(&part_file, first_half).await.unwrap();

    let entry = CatalogEntry {
        id: "resume-model".to_string(),
        repo_id: "org/test".to_string(),
        filename: "resume-model.gguf".to_string(),
        family: "test".to_string(),
        params_billions: 1.0,
        active_params_b: None,
        n_layers: 16,
        n_kv_heads: 4,
        head_dim: 64,
        context_train: 2048,
        quant: "Q4_0".to_string(),
        file_size_bytes: payload.len() as u64,
        sha256: sha,
        gated: false,
        quality_tier: 4,
        tags: vec![],
    };

    let options = DownloadOptions {
        entry,
        destination_dir: dir.path().to_path_buf(),
        hf_token: None,
        base_url_override: Some(mock_server.uri()),
        cancel_token: None,
        on_progress: None,
    };

    let final_path = download_model(options)
        .await
        .expect("Resume should succeed");
    assert!(final_path.exists());
    let read_back = tokio::fs::read(&final_path).await.unwrap();
    assert_eq!(read_back, payload);
}

#[tokio::test]
async fn test_checksum_mismatch_deletes_corrupted_file() {
    let mock_server = MockServer::start().await;
    let payload = b"CORRUPTED_BYTES_HERE";

    Mock::given(method("HEAD"))
        .and(path("/bad-model.gguf"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(payload.to_vec()))
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/bad-model.gguf"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(payload.to_vec()))
        .mount(&mock_server)
        .await;

    let dir = tempdir().unwrap();
    let entry = CatalogEntry {
        id: "bad-model".to_string(),
        repo_id: "org/test".to_string(),
        filename: "bad-model.gguf".to_string(),
        family: "test".to_string(),
        params_billions: 1.0,
        active_params_b: None,
        n_layers: 16,
        n_kv_heads: 4,
        head_dim: 64,
        context_train: 2048,
        quant: "Q4_0".to_string(),
        file_size_bytes: payload.len() as u64,
        sha256: "0000000000000000000000000000000000000000000000000000000000000000".to_string(),
        gated: false,
        quality_tier: 4,
        tags: vec![],
    };

    let options = DownloadOptions {
        entry,
        destination_dir: dir.path().to_path_buf(),
        hf_token: None,
        base_url_override: Some(mock_server.uri()),
        cancel_token: None,
        on_progress: None,
    };

    let res = download_model(options).await;
    assert!(res.is_err());
    match res.err().unwrap() {
        AppError::DownloadChecksum { expected, actual } => {
            assert_eq!(
                expected,
                "0000000000000000000000000000000000000000000000000000000000000000"
            );
            assert_ne!(actual, expected);
        }
        other => panic!("Unexpected error variant: {:?}", other),
    }

    // Assert that .part and .gguf are NOT left on disk
    let part_file = dir.path().join("bad-model.part");
    let final_file = dir.path().join("bad-model.gguf");
    assert!(
        !part_file.exists(),
        ".part file must be removed on checksum mismatch"
    );
    assert!(!final_file.exists(), ".gguf file must not exist");
}

#[tokio::test]
async fn test_gated_model_without_token_error() {
    let mock_server = MockServer::start().await;
    let dir = tempdir().unwrap();

    let entry = CatalogEntry {
        id: "gated-model".to_string(),
        repo_id: "meta/llama".to_string(),
        filename: "model.gguf".to_string(),
        family: "llama".to_string(),
        params_billions: 8.0,
        active_params_b: None,
        n_layers: 32,
        n_kv_heads: 8,
        head_dim: 128,
        context_train: 8192,
        quant: "Q4_K_M".to_string(),
        file_size_bytes: 4000000000,
        sha256: "aabbcc".to_string(),
        gated: true,
        quality_tier: 4,
        tags: vec![],
    };

    let options = DownloadOptions {
        entry,
        destination_dir: dir.path().to_path_buf(),
        hf_token: None,
        base_url_override: Some(mock_server.uri()),
        cancel_token: None,
        on_progress: None,
    };

    let res = download_model(options).await;
    assert!(res.is_err());
    match res.err().unwrap() {
        AppError::DownloadGatedNoToken => {}
        other => panic!("Unexpected error variant: {:?}", other),
    }
}

fn create_mock_gguf_bytes(
    arch: &str,
    n_layers: u32,
    n_kv_heads: u32,
    head_dim: u32,
    context_train: u32,
) -> Vec<u8> {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(b"GGUF");
    bytes.extend_from_slice(&3u32.to_le_bytes());
    bytes.extend_from_slice(&0u64.to_le_bytes());
    bytes.extend_from_slice(&5u64.to_le_bytes());

    // 1. "general.architecture" -> String (val_type = 8)
    let key1 = "general.architecture";
    bytes.extend_from_slice(&(key1.len() as u64).to_le_bytes());
    bytes.extend_from_slice(key1.as_bytes());
    bytes.extend_from_slice(&8u32.to_le_bytes());
    bytes.extend_from_slice(&(arch.len() as u64).to_le_bytes());
    bytes.extend_from_slice(arch.as_bytes());

    // 2. block_count -> u32 (val_type = 4)
    let key2 = format!("{}.block_count", arch);
    bytes.extend_from_slice(&(key2.len() as u64).to_le_bytes());
    bytes.extend_from_slice(key2.as_bytes());
    bytes.extend_from_slice(&4u32.to_le_bytes());
    bytes.extend_from_slice(&n_layers.to_le_bytes());

    // 3. head_count_kv -> u32 (val_type = 4)
    let key3 = format!("{}.attention.head_count_kv", arch);
    bytes.extend_from_slice(&(key3.len() as u64).to_le_bytes());
    bytes.extend_from_slice(key3.as_bytes());
    bytes.extend_from_slice(&4u32.to_le_bytes());
    bytes.extend_from_slice(&n_kv_heads.to_le_bytes());

    // 4. key_length -> u32 (val_type = 4)
    let key4 = format!("{}.attention.key_length", arch);
    bytes.extend_from_slice(&(key4.len() as u64).to_le_bytes());
    bytes.extend_from_slice(key4.as_bytes());
    bytes.extend_from_slice(&4u32.to_le_bytes());
    bytes.extend_from_slice(&head_dim.to_le_bytes());

    // 5. context_length -> u32 (val_type = 4)
    let key5 = format!("{}.context_length", arch);
    bytes.extend_from_slice(&(key5.len() as u64).to_le_bytes());
    bytes.extend_from_slice(key5.as_bytes());
    bytes.extend_from_slice(&4u32.to_le_bytes());
    bytes.extend_from_slice(&context_train.to_le_bytes());

    bytes
}

#[test]
fn test_gguf_header_parsing_and_cross_verification() {
    let mock_bytes = create_mock_gguf_bytes("llama", 32, 8, 128, 131072);
    let mut cursor = std::io::Cursor::new(mock_bytes);

    let header = gguf::parse_gguf_metadata(&mut cursor).expect("parse header");
    assert_eq!(header.architecture.as_deref(), Some("llama"));
    assert_eq!(header.n_layers, Some(32));
    assert_eq!(header.n_kv_heads, Some(8));
    assert_eq!(header.head_dim, Some(128));
    assert_eq!(header.context_train, Some(131072));

    let matching_entry = CatalogEntry {
        id: "llama-3.1-8b".to_string(),
        repo_id: "bartowski/llama".to_string(),
        filename: "llama.gguf".to_string(),
        family: "llama-3.1".to_string(),
        params_billions: 8.0,
        active_params_b: None,
        n_layers: 32,
        n_kv_heads: 8,
        head_dim: 128,
        context_train: 131072,
        quant: "Q4_K_M".to_string(),
        file_size_bytes: 4000000000,
        sha256: "test".to_string(),
        gated: false,
        quality_tier: 4,
        tags: vec![],
    };

    assert!(gguf::verify_gguf_against_catalog(&header, &matching_entry).is_ok());

    let mut mismatch_entry = matching_entry.clone();
    mismatch_entry.n_kv_heads = 32; // wrong MHA instead of GQA
    assert!(gguf::verify_gguf_against_catalog(&header, &mismatch_entry).is_err());
}
