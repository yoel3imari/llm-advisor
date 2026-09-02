use std::path::Path;
use domain::{AppError, CatalogEntry};
use serde::{Deserialize, Serialize};

/// Embedded catalog JSON data.
pub const BUNDLED_CATALOG_JSON: &str = include_str!("../catalog.json");

/// Default raw CDN endpoint for the upstream model catalog.
pub const DEFAULT_CATALOG_CDN_URL: &str =
    "https://raw.githubusercontent.com/yoel3imari/llm-advisor/main/crates/catalog/catalog.json";

/// Sync state metadata persisted alongside the cached catalog.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CatalogManifest {
    pub etag: Option<String>,
    pub last_synced_at: chrono::DateTime<chrono::Utc>,
    pub model_count: usize,
    pub endpoint_url: String,
}

/// Result of a remote catalog synchronization attempt.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", content = "details")]
pub enum SyncResult {
    Updated { count: usize, etag: Option<String> },
    NotModified,
}

/// Load and deserialize the bundled catalog JSON.
pub fn load_bundled_catalog() -> Result<Vec<CatalogEntry>, AppError> {
    parse_catalog_json(BUNDLED_CATALOG_JSON)
}

/// Load active catalog: checks local cached file in `app_data_dir/catalog/catalog.json`,
/// validating its integrity, and cleanly falls back to the embedded bundled catalog if missing or corrupted.
pub fn load_active_catalog(app_data_dir: Option<&Path>) -> Result<Vec<CatalogEntry>, AppError> {
    if let Some(dir) = app_data_dir {
        let cached_path = dir.join("catalog").join("catalog.json");
        if cached_path.is_file() {
            match std::fs::read_to_string(&cached_path) {
                Ok(content) => match parse_catalog_json(&content) {
                    Ok(entries) => {
                        tracing::debug!(
                            "Loaded {} models from cached catalog at {:?}",
                            entries.len(),
                            cached_path
                        );
                        return Ok(entries);
                    }
                    Err(e) => {
                        tracing::warn!(
                            "Cached catalog at {:?} is corrupted or invalid ({}). Falling back to bundled catalog.",
                            cached_path,
                            e
                        );
                    }
                },
                Err(e) => {
                    tracing::warn!(
                        "Failed to read cached catalog at {:?} ({}). Falling back to bundled catalog.",
                        cached_path,
                        e
                    );
                }
            }
        }
    }
    load_bundled_catalog()
}

/// Synchronize the catalog from a remote CDN endpoint.
///
/// Features:
/// - Uses HTTP conditional GET (`If-None-Match: <etag>`) to minimize bandwidth.
/// - Validates new entries before touching disk.
/// - Uses atomic file write (`write tmp` -> `rename`) to prevent partial catalog writes.
/// - Updates `{app_data_dir}/catalog/manifest.json`.
pub async fn sync_catalog_from_remote(
    app_data_dir: &Path,
    endpoint_url: &str,
) -> Result<SyncResult, AppError> {
    let catalog_dir = app_data_dir.join("catalog");
    let manifest_path = catalog_dir.join("manifest.json");
    let catalog_path = catalog_dir.join("catalog.json");
    let temp_catalog_path = catalog_dir.join("catalog.json.tmp");

    let previous_etag = if manifest_path.exists() {
        std::fs::read_to_string(&manifest_path)
            .ok()
            .and_then(|data| serde_json::from_str::<CatalogManifest>(&data).ok())
            .and_then(|m| m.etag)
    } else {
        None
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("llm-advisor-catalog-sync/1.0")
        .build()
        .map_err(|e| AppError::DownloadNetwork(format!("Failed to build HTTP client: {}", e)))?;

    let mut req = client.get(endpoint_url);
    if let Some(ref etag) = previous_etag {
        req = req.header("If-None-Match", etag);
    }

    let resp = req.send().await.map_err(|e| {
        AppError::DownloadNetwork(format!("Failed to fetch remote catalog from {}: {}", endpoint_url, e))
    })?;

    if resp.status() == reqwest::StatusCode::NOT_MODIFIED {
        tracing::debug!("Remote catalog returned 304 Not Modified");
        if let Ok(manifest_data) = std::fs::read_to_string(&manifest_path) {
            if let Ok(mut manifest) = serde_json::from_str::<CatalogManifest>(&manifest_data) {
                manifest.last_synced_at = chrono::Utc::now();
                let _ = std::fs::write(&manifest_path, serde_json::to_string_pretty(&manifest).unwrap_or_default());
            }
        }
        return Ok(SyncResult::NotModified);
    }

    if !resp.status().is_success() {
        return Err(AppError::DownloadNetwork(format!(
            "Remote catalog endpoint returned HTTP {}",
            resp.status()
        )));
    }

    let new_etag = resp
        .headers()
        .get("etag")
        .or_else(|| resp.headers().get("ETag"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim_matches('"').to_string());

    let body = resp.text().await.map_err(|e| {
        AppError::DownloadNetwork(format!("Failed to read catalog response body: {}", e))
    })?;

    // Validate entries strictly before persisting
    let entries = parse_catalog_json(&body)?;

    if let Err(e) = std::fs::create_dir_all(&catalog_dir) {
        return Err(AppError::Io(format!("Failed to create catalog directory: {}", e)));
    }

    if let Err(e) = std::fs::write(&temp_catalog_path, &body) {
        return Err(AppError::Io(format!("Failed to write temporary catalog file: {}", e)));
    }

    if let Err(e) = std::fs::rename(&temp_catalog_path, &catalog_path) {
        return Err(AppError::Io(format!("Failed to atomically replace catalog file: {}", e)));
    }

    let manifest = CatalogManifest {
        etag: new_etag.clone(),
        last_synced_at: chrono::Utc::now(),
        model_count: entries.len(),
        endpoint_url: endpoint_url.to_string(),
    };

    if let Ok(json) = serde_json::to_string_pretty(&manifest) {
        let _ = std::fs::write(&manifest_path, json);
    }

    Ok(SyncResult::Updated {
        count: entries.len(),
        etag: new_etag,
    })
}

/// Retrieve the active catalog manifest if one exists.
pub fn get_manifest(app_data_dir: &Path) -> Option<CatalogManifest> {
    let manifest_path = app_data_dir.join("catalog").join("manifest.json");
    if manifest_path.exists() {
        std::fs::read_to_string(&manifest_path)
            .ok()
            .and_then(|d| serde_json::from_str(&d).ok())
    } else {
        None
    }
}

/// Parse and validate catalog entries from JSON string.
pub fn parse_catalog_json(json_str: &str) -> Result<Vec<CatalogEntry>, AppError> {
    let entries: Vec<CatalogEntry> = serde_json::from_str(json_str)
        .map_err(|e| AppError::CatalogParse(format!("Failed to parse catalog JSON: {}", e)))?;

    for entry in &entries {
        if entry.id.is_empty() {
            return Err(AppError::CatalogParse(
                "Catalog entry has empty id".to_string(),
            ));
        }
        if entry.file_size_bytes == 0 {
            return Err(AppError::CatalogParse(format!(
                "Catalog entry '{}' has 0 file_size_bytes",
                entry.id
            )));
        }
        if entry.n_kv_heads == 0 {
            return Err(AppError::CatalogParse(format!(
                "Catalog entry '{}' has invalid n_kv_heads (0)",
                entry.id
            )));
        }
        if entry.sha256.len() != 64 {
            return Err(AppError::CatalogParse(format!(
                "Catalog entry '{}' has invalid sha256 checksum length (got {})",
                entry.id,
                entry.sha256.len()
            )));
        }
    }

    Ok(entries)
}

/// Find a specific catalog entry by its identifier in the active catalog.
pub fn find_entry_in_catalog(id: &str, app_data_dir: Option<&Path>) -> Option<CatalogEntry> {
    load_active_catalog(app_data_dir)
        .ok()
        .and_then(|entries| entries.into_iter().find(|e| e.id == id))
}

/// Find a specific catalog entry by its identifier in the bundled catalog.
pub fn find_entry(id: &str) -> Option<CatalogEntry> {
    find_entry_in_catalog(id, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_bundled_catalog() {
        let catalog = load_bundled_catalog().expect("Bundled catalog must parse cleanly");
        assert_eq!(catalog.len(), 54);

        // Verify specific models
        let tiny = catalog
            .iter()
            .find(|e| e.id == "tinyllama-15m-q4_k_m")
            .unwrap();
        assert_eq!(tiny.family, "tinyllama");
        assert_eq!(tiny.n_layers, 6);
        assert_eq!(tiny.n_kv_heads, 6);
        assert_eq!(tiny.head_dim, 48);
        assert_eq!(tiny.file_size_bytes, 14650848);

        let llama = catalog
            .iter()
            .find(|e| e.id == "llama-3.1-8b-instruct-q4_k_m")
            .unwrap();
        assert_eq!(llama.family, "llama-3.1");
        assert_eq!(llama.n_layers, 32);
        assert_eq!(llama.n_kv_heads, 8);
        assert_eq!(llama.head_dim, 128);
        assert_eq!(llama.quality_tier, 4);

        let deepseek = catalog
            .iter()
            .find(|e| e.id == "deepseek-r1-distill-qwen-7b-q4_k_m")
            .unwrap();
        assert_eq!(deepseek.family, "deepseek-r1");
        assert_eq!(deepseek.n_layers, 28);
        assert_eq!(deepseek.n_kv_heads, 4);

        let coder = catalog
            .iter()
            .find(|e| e.id == "qwen2.5-coder-7b-instruct-q4_k_m")
            .unwrap();
        assert_eq!(coder.family, "qwen2.5-coder");
        assert_eq!(coder.n_layers, 28);

        let moe = catalog
            .iter()
            .find(|e| e.id == "mixtral-8x7b-instruct-v0.1-q4_k_m")
            .unwrap();
        assert_eq!(moe.family, "mixtral");
        assert_eq!(moe.active_params_b, Some(12.9));

        for entry in &catalog {
            assert!(!entry.id.is_empty());
            assert!(entry.file_size_bytes > 0);
            assert_eq!(entry.sha256.len(), 64);
        }
    }

    #[test]
    fn test_find_entry() {
        let entry = find_entry("qwen2.5-0.5b-instruct-q4_k_m");
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().params_billions, 0.49);

        let nonexistent = find_entry("unknown-model-xyz");
        assert!(nonexistent.is_none());
    }

    #[test]
    fn test_negative_corrupted_catalog() {
        let corrupted_json = r#"[
            {
                "id": "corrupted-model",
                "repo_id": "test/repo",
                "filename": "test.gguf",
                "family": "test",
                "params_billions": 1.0,
                "n_layers": 16,
                "n_kv_heads": 4,
                "head_dim": 64,
                "context_train": 2048,
                "quant": "Q4_0",
                "file_size_bytes": 0,
                "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                "gated": false,
                "quality_tier": 4,
                "tags": []
            }
        ]"#;

        let res = parse_catalog_json(corrupted_json);
        assert!(res.is_err());
        match res.err().unwrap() {
            AppError::CatalogParse(msg) => {
                assert!(msg.contains("corrupted-model"));
                assert!(msg.contains("0 file_size_bytes"));
            }
            other => panic!("Unexpected error variant: {:?}", other),
        }
    }

    #[test]
    fn test_load_active_catalog_fallback() {
        // None directory falls back to bundled
        let cat_none = load_active_catalog(None).unwrap();
        assert_eq!(cat_none.len(), 54);

        // Missing catalog directory falls back to bundled
        let tmp = tempfile::tempdir().unwrap();
        let cat_empty = load_active_catalog(Some(tmp.path())).unwrap();
        assert_eq!(cat_empty.len(), 54);

        // Corrupted catalog in cache falls back to bundled
        let cat_dir = tmp.path().join("catalog");
        std::fs::create_dir_all(&cat_dir).unwrap();
        std::fs::write(cat_dir.join("catalog.json"), "invalid json content").unwrap();

        let cat_corrupt = load_active_catalog(Some(tmp.path())).unwrap();
        assert_eq!(cat_corrupt.len(), 54);
    }

    #[test]
    fn test_load_active_catalog_from_cached_file() {
        let tmp = tempfile::tempdir().unwrap();
        let cat_dir = tmp.path().join("catalog");
        std::fs::create_dir_all(&cat_dir).unwrap();

        let sample_entry = r#"[
            {
                "id": "mock-custom-model-q4_k_m",
                "repo_id": "mock/model-gguf",
                "filename": "model-q4.gguf",
                "family": "custom-family",
                "params_billions": 7.0,
                "n_layers": 32,
                "n_kv_heads": 8,
                "head_dim": 128,
                "context_train": 8192,
                "quant": "Q4_K_M",
                "file_size_bytes": 4000000000,
                "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                "gated": false,
                "quality_tier": 5,
                "tags": ["custom"]
            }
        ]"#;

        std::fs::write(cat_dir.join("catalog.json"), sample_entry).unwrap();

        let active = load_active_catalog(Some(tmp.path())).unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, "mock-custom-model-q4_k_m");
        assert_eq!(active[0].family, "custom-family");

        let found = find_entry_in_catalog("mock-custom-model-q4_k_m", Some(tmp.path()));
        assert!(found.is_some());
        assert_eq!(found.unwrap().params_billions, 7.0);
    }

    #[tokio::test]
    async fn test_sync_catalog_from_remote_workflow() {
        use wiremock::matchers::{header, method, path};
        use wiremock::{Mock, MockServer, ResponseTemplate};

        let server = MockServer::start().await;
        let tmp = tempfile::tempdir().unwrap();

        let catalog_payload = r#"[
            {
                "id": "remote-synced-model",
                "repo_id": "remote/synced-gguf",
                "filename": "synced.gguf",
                "family": "gemma-4",
                "params_billions": 12.0,
                "n_layers": 40,
                "n_kv_heads": 8,
                "head_dim": 128,
                "context_train": 131072,
                "quant": "Q4_0",
                "file_size_bytes": 6500000000,
                "sha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
                "gated": false,
                "quality_tier": 5,
                "tags": ["gemma-4"]
            }
        ]"#;

        // 1. Initial sync (200 OK with ETag)
        Mock::given(method("GET"))
            .and(path("/catalog.json"))
            .respond_with(
                ResponseTemplate::new(200)
                    .set_body_string(catalog_payload)
                    .insert_header("etag", "\"tag-v1\""),
            )
            .up_to_n_times(1)
            .mount(&server)
            .await;

        let endpoint = format!("{}/catalog.json", server.uri());
        let sync_res1 = sync_catalog_from_remote(tmp.path(), &endpoint).await.unwrap();

        assert_eq!(
            sync_res1,
            SyncResult::Updated {
                count: 1,
                etag: Some("tag-v1".to_string())
            }
        );

        // Verify file on disk
        let loaded = load_active_catalog(Some(tmp.path())).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "remote-synced-model");

        let manifest = get_manifest(tmp.path()).expect("Manifest must exist");
        assert_eq!(manifest.etag, Some("tag-v1".to_string()));
        assert_eq!(manifest.model_count, 1);

        // 2. Subsequent sync with If-None-Match matching tag-v1 (304 Not Modified)
        Mock::given(method("GET"))
            .and(path("/catalog.json"))
            .and(header("if-none-match", "tag-v1"))
            .respond_with(ResponseTemplate::new(304))
            .mount(&server)
            .await;

        let sync_res2 = sync_catalog_from_remote(tmp.path(), &endpoint).await.unwrap();
        assert_eq!(sync_res2, SyncResult::NotModified);

        // Active catalog remains unchanged
        let loaded_again = load_active_catalog(Some(tmp.path())).unwrap();
        assert_eq!(loaded_again.len(), 1);
        assert_eq!(loaded_again[0].id, "remote-synced-model");
    }
}
