use chrono::Utc;
use domain::{CatalogEntry, HardwareProfile, KvType, ServeConfig};
use fit_engine::*;

fn sample_llama31_8b_entry() -> CatalogEntry {
    CatalogEntry {
        id: "llama-3.1-8b-instruct-q4_k_m".to_string(),
        repo_id: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF".to_string(),
        filename: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf".to_string(),
        family: "llama-3.1".to_string(),
        params_billions: 8.03,
        active_params_b: None,
        n_layers: 32,
        n_kv_heads: 8, // GQA
        head_dim: 128,
        context_train: 131072,
        quant: "Q4_K_M".to_string(),
        file_size_bytes: 4920727040,
        sha256: "4b6e5b4b1df8f4a3be9e1c258f2780e8e7a0cbcfdc1f1a563ee9a9978732e4d0".to_string(),
        gated: false,
        quality_tier: 4,
        tags: vec!["llama".to_string()],
    }
}

fn sample_profile_16gb_intel() -> HardwareProfile {
    HardwareProfile {
        cpu_name: "Intel Core i9-9880H".to_string(),
        arch: "x86_64".to_string(),
        cpu_physical_cores: 8,
        cpu_logical_cores: 16,
        gpu_name: Some("AMD Radeon Pro 5500M".to_string()),
        gpu_vram_bytes: Some(4 * 1024 * 1024 * 1024), // 4GB VRAM
        has_unified_memory: false,
        total_ram_bytes: 16 * 1024 * 1024 * 1024,
        metal_working_set_bytes: 12 * 1024 * 1024 * 1024, // 12GB working set
        disk_free_bytes: 100 * 1024 * 1024 * 1024,
        os_version: "macOS 14.5".to_string(),
        detected_at: Utc::now(),
    }
}

#[test]
fn test_golden_llama31_8b_exact_kv_and_memory() {
    let entry = sample_llama31_8b_entry();
    let profile = sample_profile_16gb_intel();
    let cfg = ServeConfig {
        context_size: 4096,
        n_parallel: 1,
        kv_type: KvType::F16,
        n_gpu_layers: None,
    };

    // Exact math:
    // KV = 2 * 32 * 8 * 128 * 4096 * 2 * 1 = 536,870,912 bytes
    let kv = calculate_kv_cache_bytes(&entry, 4096, &cfg);
    assert_eq!(
        kv, 536870912,
        "KV cache bytes must match exact golden value"
    );

    let (weights, computed_kv, total) = estimate_total_memory_bytes(&entry, 4096, &cfg);
    assert_eq!(weights, 4920727040);
    assert_eq!(computed_kv, 536870912);
    // activations = ceil(0.05 * 4920727040) = 246036352
    // overhead = 734003200 (700MB)
    // total = 4920727040 + 536870912 + 246036352 + 734003200 = 6437637504
    assert_eq!(
        total, 6437637504,
        "Total estimated memory must match exact golden sum"
    );

    let result = evaluate(&profile, &entry, &cfg);
    assert!(result.fits, "Llama 3.1 8B Q4_K_M must fit on 16GB Mac");
    assert_eq!(result.est_kv_bytes, 536870912);
    assert_eq!(result.est_total_bytes, 6437637504);
    assert!(result.recommended_gpu_layers > 15 && result.recommended_gpu_layers <= 32);
}

#[test]
fn test_golden_llama31_8b_on_8gb_tight_or_nofit() {
    let entry = sample_llama31_8b_entry();
    let profile_8gb = HardwareProfile {
        cpu_name: "Intel Core i5".to_string(),
        arch: "x86_64".to_string(),
        cpu_physical_cores: 4,
        cpu_logical_cores: 8,
        gpu_name: None,
        gpu_vram_bytes: None,
        has_unified_memory: false,
        total_ram_bytes: 8 * 1024 * 1024 * 1024,
        metal_working_set_bytes: 6 * 1024 * 1024 * 1024, // 6GB budget
        disk_free_bytes: 50 * 1024 * 1024 * 1024,
        os_version: "macOS 14.5".to_string(),
        detected_at: Utc::now(),
    };

    // Context 8192
    let cfg = ServeConfig {
        context_size: 8192,
        n_parallel: 1,
        kv_type: KvType::F16,
        n_gpu_layers: None,
    };

    let result = evaluate(&profile_8gb, &entry, &cfg);
    assert!(!result.fits, "8B @ ctx=8192 cannot fit in 6GB budget");
    assert!(result.max_context_that_fits < 8192);
    assert_eq!(result.recommended_gpu_layers, 0);
}

#[test]
fn test_golden_moe_mixtral_active_params_speed() {
    let moe_entry = CatalogEntry {
        id: "mixtral-8x7b-instruct-v0.1-q4_k_m".to_string(),
        repo_id: "TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF".to_string(),
        filename: "mixtral-8x7b-instruct-v0.1.Q4_K_M.gguf".to_string(),
        family: "mixtral".to_string(),
        params_billions: 46.7,
        active_params_b: Some(12.9),
        n_layers: 32,
        n_kv_heads: 8,
        head_dim: 128,
        context_train: 32768,
        quant: "Q4_K_M".to_string(),
        file_size_bytes: 26442045696,
        sha256: "a09ba8fa0172605eb82efd14ca2a045952c4ca70a92d24268e0d9385bf564499".to_string(),
        gated: false,
        quality_tier: 4,
        tags: vec!["moe".to_string()],
    };

    let profile_128gb = HardwareProfile {
        cpu_name: "Intel Xeon W".to_string(),
        arch: "x86_64".to_string(),
        cpu_physical_cores: 16,
        cpu_logical_cores: 32,
        gpu_name: Some("AMD Radeon Pro Vega II".to_string()),
        gpu_vram_bytes: Some(32 * 1024 * 1024 * 1024),
        has_unified_memory: false,
        total_ram_bytes: 128 * 1024 * 1024 * 1024,
        metal_working_set_bytes: 96 * 1024 * 1024 * 1024,
        disk_free_bytes: 500 * 1024 * 1024 * 1024,
        os_version: "macOS 14.5".to_string(),
        detected_at: Utc::now(),
    };

    let cfg = ServeConfig::default();
    let result = evaluate(&profile_128gb, &moe_entry, &cfg);

    assert!(result.fits);
    // Weights are ~26.4GB
    assert_eq!(result.est_weights_bytes, 26442045696);
    // Speed should use active 12.9B params instead of 46.7B total
    assert!(
        result.speed_tps_estimate > 5.0,
        "MoE speed should reflect active params"
    );
}

#[test]
fn test_property_monotonicity_context_size() {
    let entry = sample_llama31_8b_entry();
    let cfg = ServeConfig::default();

    let (_, _, total_512) = estimate_total_memory_bytes(&entry, 512, &cfg);
    let (_, _, total_2048) = estimate_total_memory_bytes(&entry, 2048, &cfg);
    let (_, _, total_4096) = estimate_total_memory_bytes(&entry, 4096, &cfg);
    let (_, _, total_8192) = estimate_total_memory_bytes(&entry, 8192, &cfg);

    assert!(total_512 < total_2048);
    assert!(total_2048 < total_4096);
    assert!(total_4096 < total_8192);
}

#[test]
fn test_property_parallel_slots_multiplication() {
    let entry = sample_llama31_8b_entry();
    let cfg_1 = ServeConfig {
        n_parallel: 1,
        ..Default::default()
    };
    let cfg_2 = ServeConfig {
        n_parallel: 2,
        ..Default::default()
    };
    let cfg_4 = ServeConfig {
        n_parallel: 4,
        ..Default::default()
    };

    let kv_1 = calculate_kv_cache_bytes(&entry, 4096, &cfg_1);
    let kv_2 = calculate_kv_cache_bytes(&entry, 4096, &cfg_2);
    let kv_4 = calculate_kv_cache_bytes(&entry, 4096, &cfg_4);

    assert_eq!(kv_2, kv_1 * 2);
    assert_eq!(kv_4, kv_1 * 4);
}

#[test]
fn test_kv_q8_0_halves_kv_cache() {
    let entry = sample_llama31_8b_entry();
    let cfg_f16 = ServeConfig {
        kv_type: KvType::F16,
        ..Default::default()
    };
    let cfg_q8 = ServeConfig {
        kv_type: KvType::Q8_0,
        ..Default::default()
    };

    let kv_f16 = calculate_kv_cache_bytes(&entry, 4096, &cfg_f16);
    let kv_q8 = calculate_kv_cache_bytes(&entry, 4096, &cfg_q8);

    assert_eq!(kv_f16, kv_q8 * 2);
}

#[test]
fn test_mutant_detection_wrong_kv_heads_fails() {
    // Mutant entry with n_kv_heads = 32 (standard n_head instead of GQA 8)
    let mut mutant_entry = sample_llama31_8b_entry();
    mutant_entry.n_kv_heads = 32;

    let cfg = ServeConfig::default();
    let kv_mutant = calculate_kv_cache_bytes(&mutant_entry, 4096, &cfg);
    let golden_expected_kv = 536870912;

    // The mutant KV cache must be 4x inflated and NOT equal the golden expected value
    assert_eq!(kv_mutant, golden_expected_kv * 4);
    assert_ne!(
        kv_mutant, golden_expected_kv,
        "Mutant must be caught by golden check"
    );
}

#[test]
fn test_llama_3_1_70b_q2_k_on_16gb_ram_fails() {
    let profile = HardwareProfile {
        cpu_name: "Intel Core i9".to_string(),
        arch: "x86_64".to_string(),
        cpu_physical_cores: 8,
        cpu_logical_cores: 16,
        gpu_name: Some("AMD Radeon Pro 5500M".to_string()),
        gpu_vram_bytes: Some(4 * 1024 * 1024 * 1024),
        has_unified_memory: false,
        total_ram_bytes: 16 * 1024 * 1024 * 1024,
        metal_working_set_bytes: 12 * 1024 * 1024 * 1024,
        disk_free_bytes: 100 * 1024 * 1024 * 1024,
        os_version: "macOS 14.5".to_string(),
        detected_at: Utc::now(),
    };

    let entry = CatalogEntry {
        id: "llama-3.1-70b-q2_k".to_string(),
        repo_id: "bartowski/Meta-Llama-3.1-70B-Instruct-GGUF".to_string(),
        filename: "Meta-Llama-3.1-70B-Instruct-Q2_K.gguf".to_string(),
        family: "llama-3.1".to_string(),
        params_billions: 70.6,
        active_params_b: None,
        n_layers: 80,
        n_kv_heads: 8,
        head_dim: 128,
        context_train: 131072,
        quant: "Q2_K".to_string(),
        file_size_bytes: 28 * 1024 * 1024 * 1024, // 28GB weights
        sha256: "fake_sha".to_string(),
        gated: false,
        quality_tier: 5,
        tags: vec![],
    };

    let cfg = ServeConfig::default();
    let result = evaluate(&profile, &entry, &cfg);

    assert!(!result.fits, "70B model must NOT fit in 12GB working set");
    assert_eq!(result.score_fit, 0.0);
}

#[test]
fn test_gemma_2_9b_head_dim_deviation() {
    // Gemma 2 explicitly uses head_dim = 256, rather than hidden_size / n_heads (3584 / 16 = 224 or 3072 / 16 = 192)
    let entry = CatalogEntry {
        id: "gemma-2-9b-it-q4_k_m".to_string(),
        repo_id: "bartowski/gemma-2-9b-it-GGUF".to_string(),
        filename: "gemma-2-9b-it-Q4_K_M.gguf".to_string(),
        family: "gemma-2".to_string(),
        params_billions: 9.24,
        active_params_b: None,
        n_layers: 42,
        n_kv_heads: 8,
        head_dim: 256, // Explicit decoupled head_dim
        context_train: 8192,
        quant: "Q4_K_M".to_string(),
        file_size_bytes: 5800000000,
        sha256: "gemma_sha".to_string(),
        gated: false,
        quality_tier: 4,
        tags: vec![],
    };

    let cfg = ServeConfig {
        context_size: 4096,
        n_parallel: 1,
        kv_type: KvType::F16,
        n_gpu_layers: None,
    };

    let kv = calculate_kv_cache_bytes(&entry, 4096, &cfg);
    // KV = 2 * 42 * 8 * 256 * 4096 * 2 * 1 = 1,409,286,144 bytes (~1.31 GiB)
    assert_eq!(kv, 2 * 42 * 8 * 256 * 4096 * 2);
}
