use chrono::Utc;
use domain::*;
use std::path::PathBuf;

#[test]
fn test_catalog_entry_serde_roundtrip() {
    let fixture_str = include_str!("fixtures/catalog_entry.json");
    let entry: CatalogEntry =
        serde_json::from_str(fixture_str).expect("Failed to deserialize fixture");

    assert_eq!(entry.id, "llama-3.1-8b-instruct-q4_k_m");
    assert_eq!(entry.n_layers, 32);
    assert_eq!(entry.n_kv_heads, 8); // GQA verification
    assert_eq!(entry.head_dim, 128);
    assert_eq!(entry.quality_tier, 4);

    let serialized = serde_json::to_string(&entry).expect("Failed to serialize entry");
    let roundtrip: CatalogEntry =
        serde_json::from_str(&serialized).expect("Failed to deserialize roundtrip");
    assert_eq!(entry, roundtrip);
}

#[test]
fn test_hardware_profile_serde_roundtrip() {
    let profile = HardwareProfile {
        cpu_name: "Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz".to_string(),
        arch: "x86_64".to_string(),
        cpu_physical_cores: 8,
        cpu_logical_cores: 16,
        gpu_name: Some("AMD Radeon Pro 5500M".to_string()),
        gpu_vram_bytes: Some(4 * 1024 * 1024 * 1024),
        has_unified_memory: false,
        total_ram_bytes: 16 * 1024 * 1024 * 1024,
        metal_working_set_bytes: 12 * 1024 * 1024 * 1024,
        disk_free_bytes: 250 * 1024 * 1024 * 1024,
        os_version: "macOS 14.5".to_string(),
        detected_at: Utc::now(),
        gpu_bandwidth_gbps: Some(192.0),
        host_bandwidth_gbps: 40.0,
    };

    let serialized = serde_json::to_string(&profile).expect("serialize");
    let deserialized: HardwareProfile = serde_json::from_str(&serialized).expect("deserialize");
    assert_eq!(profile, deserialized);
}

#[test]
fn test_download_state_serde_and_negative() {
    let state = DownloadState::Downloading {
        bytes_done: 1024,
        total_bytes: 2048,
    };
    let json = serde_json::to_string(&state).unwrap();
    let decoded: DownloadState = serde_json::from_str(&json).unwrap();
    assert_eq!(state, decoded);

    // Negative: unknown state rejected
    let invalid = "{\"status\": \"exploded\"}";
    let res: Result<DownloadState, _> = serde_json::from_str(invalid);
    assert!(res.is_err());
}

#[test]
fn test_model_record_and_fit_result_serde() {
    let record = ModelRecord {
        entry_id: "test-model".to_string(),
        file_path: PathBuf::from("/models/test.gguf"),
        size_bytes: 1234567,
        verified: true,
        added_at: Utc::now(),
    };
    let json = serde_json::to_string(&record).unwrap();
    let deserialized: ModelRecord = serde_json::from_str(&json).unwrap();
    assert_eq!(record, deserialized);

    let fixture_str = include_str!("fixtures/catalog_entry.json");
    let entry: CatalogEntry = serde_json::from_str(fixture_str).unwrap();

    let fit = FitResult {
        entry,
        fits: true,
        est_weights_bytes: 4920727040,
        est_kv_bytes: 536870912,
        est_total_bytes: 6437637504,
        max_context_that_fits: 131072,
        usable_context: 131072,
        is_context_constrained: false,
        recommended_gpu_layers: 24,
        speed_tps_estimate: 32.5,
        score_fit: 8.5,
        score_speed: 7.2,
        score_quality: 8.0,
    };
    let fit_json = serde_json::to_string(&fit).unwrap();
    let fit_deserialized: FitResult = serde_json::from_str(&fit_json).unwrap();
    assert_eq!(fit, fit_deserialized);
}

#[test]
fn test_app_error_messages() {
    let err = AppError::DownloadChecksum {
        expected: "abc".to_string(),
        actual: "def".to_string(),
    };
    assert_eq!(
        err.to_string(),
        "Download checksum mismatch: expected abc, actual def"
    );

    let gated_err = AppError::DownloadGatedNoToken;
    assert!(gated_err.to_string().contains("gated"));
}

#[test]
fn test_running_instance_info_serde() {
    let inst = RunningInstanceInfo {
        model_id: "smollm2-135m-instruct-q8_0".to_string(),
        model_path: PathBuf::from("/models/smollm2.gguf"),
        port: 18080,
        context_size: 4096,
        started_at: Utc::now(),
    };
    let json = serde_json::to_string(&inst).unwrap();
    let decoded: RunningInstanceInfo = serde_json::from_str(&json).unwrap();
    assert_eq!(inst, decoded);
}
