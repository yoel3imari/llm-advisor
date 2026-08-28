//! Static model catalog module for Local LLM Advisor.

use domain::{AppError, CatalogEntry};

/// Embedded catalog JSON data.
pub const BUNDLED_CATALOG_JSON: &str = include_str!("../catalog.json");

/// Load and deserialize the bundled catalog JSON.
pub fn load_bundled_catalog() -> Result<Vec<CatalogEntry>, AppError> {
    parse_catalog_json(BUNDLED_CATALOG_JSON)
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

/// Find a specific catalog entry by its identifier.
pub fn find_entry(id: &str) -> Option<CatalogEntry> {
    load_bundled_catalog()
        .ok()
        .and_then(|entries| entries.into_iter().find(|e| e.id == id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_bundled_catalog() {
        let catalog = load_bundled_catalog().expect("Bundled catalog must parse cleanly");
        assert_eq!(catalog.len(), 53);

        // Verify specific models
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
}
