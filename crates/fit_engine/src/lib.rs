//! Mathematical RAM/VRAM memory-fit estimation engine for LLM Advisor.
//!
//! Ground-truth formulas:
//! - Weights = entry.file_size_bytes
//! - KV Cache = 2 * n_layers * n_kv_heads * head_dim * min(ctx, context_train) * kv_bytes_per_elem * n_parallel
//!   CRITICAL: Uses GQA n_kv_heads (e.g., 8 for Llama 3.1 8B), never total n_head (32).
//! - Activations Margin = ceil(0.05 * weights)
//! - Runtime Overhead Floor = 700 MB (734,003,200 bytes)

use domain::{CatalogEntry, FitResult, HardwareProfile, ServeConfig};

/// Runtime overhead floor in bytes (700 MB).
pub const RUNTIME_OVERHEAD_FLOOR_BYTES: u64 = 700 * 1024 * 1024;

/// Safety margin: empirically, activation memory grows with batch/sequence length
/// but we don't model it directly in v1. 5% of weights is a conservative fudge
/// factor that compensates for intermediate tensors and peak memory spikes.
/// Real activation memory is sequence-dependent; consider adding a proper
/// formula if users report memory issues at large contexts.
pub const ACTIVATIONS_MARGIN: f64 = 0.05;

/// Calculate the KV cache size in bytes for a given context size and serving config.
pub fn calculate_kv_cache_bytes(entry: &CatalogEntry, ctx: u32, cfg: &ServeConfig) -> u64 {
    let effective_ctx = ctx.min(entry.context_train) as u64;
    let kv_elem_bytes = cfg.kv_type.bytes_per_element();
    let slots = cfg.n_parallel.max(1) as u64;

    let elements = 2
        * (entry.n_layers as u64)
        * (entry.n_kv_heads as u64)
        * (entry.head_dim as u64)
        * effective_ctx
        * slots;

    ((elements as f64) * kv_elem_bytes).ceil() as u64
}

/// Calculate the total estimated memory needed in bytes for a model and context size.
pub fn estimate_total_memory_bytes(
    entry: &CatalogEntry,
    ctx: u32,
    cfg: &ServeConfig,
) -> (u64, u64, u64) {
    let weights = entry.file_size_bytes;
    let kv = calculate_kv_cache_bytes(entry, ctx, cfg);
    let activations = ((weights as f64) * ACTIVATIONS_MARGIN).ceil() as u64;
    let total = weights + kv + activations + RUNTIME_OVERHEAD_FLOOR_BYTES;
    (weights, kv, total)
}

/// Calculate the host memory budget available for model inference.
pub fn calculate_host_budget(profile: &HardwareProfile) -> u64 {
    std::cmp::min(profile.metal_working_set_bytes, profile.total_ram_bytes)
}

/// Binary search for the maximum context size in [512..context_train] that fits in host memory.
pub fn calculate_max_context_that_fits(
    entry: &CatalogEntry,
    profile: &HardwareProfile,
    cfg: &ServeConfig,
) -> u32 {
    let host_budget = calculate_host_budget(profile);
    let min_ctx = 512u32;
    let max_ctx = entry.context_train.max(min_ctx);

    let (_, _, min_total) = estimate_total_memory_bytes(entry, min_ctx, cfg);
    if min_total > host_budget {
        return min_ctx;
    }

    let (_, _, max_total) = estimate_total_memory_bytes(entry, max_ctx, cfg);
    if max_total <= host_budget {
        return max_ctx;
    }

    let mut low = min_ctx;
    let mut high = max_ctx;
    let mut best = min_ctx;

    while low <= high {
        let mid = low + (high - low) / 2;
        let (_, _, est_total) = estimate_total_memory_bytes(entry, mid, cfg);
        if est_total <= host_budget {
            best = mid;
            low = mid + 1;
        } else {
            if mid == 0 {
                break;
            }
            high = mid - 1;
        }
    }

    best
}

/// Calculate the dynamic usable context and determine whether context is constrained by available memory.
pub fn calculate_usable_context(
    entry: &CatalogEntry,
    profile: &HardwareProfile,
    cfg: &ServeConfig,
) -> (u32, bool) {
    let host_budget = calculate_host_budget(profile);
    let weights = entry.file_size_bytes;
    let activations = ((weights as f64) * ACTIVATIONS_MARGIN).ceil() as u64;
    let base_overhead = weights + activations + RUNTIME_OVERHEAD_FLOOR_BYTES;

    if base_overhead > host_budget {
        return (0, true);
    }

    let leftover_bytes = host_budget.saturating_sub(base_overhead);
    let kv_elem_bytes = cfg.kv_type.bytes_per_element();
    let slots = cfg.n_parallel.max(1) as u64;
    let bytes_per_token = 2.0
        * (entry.n_layers as f64)
        * (entry.n_kv_heads as f64)
        * (entry.head_dim as f64)
        * kv_elem_bytes
        * (slots as f64);

    if bytes_per_token <= 0.0 {
        return (entry.context_train, false);
    }

    let max_tokens = (leftover_bytes as f64 / bytes_per_token).floor() as u32;
    if max_tokens >= entry.context_train {
        (entry.context_train, false)
    } else {
        let usable = max_tokens.max(512).min(entry.context_train);
        (usable, true)
    }
}

/// Calculate recommended GPU layer offloading based on dedicated GPU VRAM budget.
pub fn calculate_recommended_gpu_layers(
    entry: &CatalogEntry,
    profile: &HardwareProfile,
    weights_bytes: u64,
    kv_bytes: u64,
) -> u32 {
    let vram = match profile.gpu_vram_bytes {
        Some(v) if v > 0 => v,
        _ => return 0,
    };

    if entry.n_layers == 0 {
        return 0;
    }

    let layer_weight = weights_bytes / (entry.n_layers as u64);
    let kv_per_layer = kv_bytes / (entry.n_layers as u64);
    let layer_total = layer_weight + kv_per_layer;

    if layer_total == 0 {
        return 0;
    }

    // Allocate 200MB floor for GPU context / display overhead
    let vram_overhead = 200 * 1024 * 1024;
    let available_vram = vram.saturating_sub(vram_overhead);

    let offloadable_layers = available_vram / layer_total;
    std::cmp::min(entry.n_layers as u64, offloadable_layers) as u32
}

/// Estimate tokens-per-second throughput using the Memory Bandwidth Roofline model.
pub fn estimate_speed_tps(
    entry: &CatalogEntry,
    profile: &HardwareProfile,
    recommended_gpu_layers: u32,
) -> f32 {
    let weight_gb = (entry.file_size_bytes as f32) / (1024.0 * 1024.0 * 1024.0);
    let active_weight_gb = if let Some(active_b) = entry.active_params_b {
        if entry.params_billions > 0.0 {
            weight_gb * (active_b / entry.params_billions)
        } else {
            weight_gb
        }
    } else {
        weight_gb
    }
    .max(0.1);

    let host_bw = if profile.host_bandwidth_gbps > 0.0 {
        profile.host_bandwidth_gbps
    } else {
        40.0
    };

    let gpu_bw = profile.gpu_bandwidth_gbps.unwrap_or_else(|| {
        if profile.gpu_vram_bytes.unwrap_or(0) > 0 {
            220.0
        } else {
            host_bw
        }
    });

    let (effective_bandwidth, run_mode_factor) = if entry.n_layers > 0 && recommended_gpu_layers > 0
    {
        let gpu_ratio = (recommended_gpu_layers as f32) / (entry.n_layers as f32);
        if gpu_ratio >= 0.99 {
            let factor = if entry.active_params_b.is_some() {
                0.8
            } else {
                1.0
            };
            (gpu_bw, factor)
        } else {
            let cpu_ratio = 1.0 - gpu_ratio;
            let bw = (gpu_ratio * gpu_bw) + (cpu_ratio * host_bw);
            (bw, 0.5)
        }
    } else {
        (host_bw, 0.3)
    };

    let efficiency = 0.55f32;
    let raw_tps = (effective_bandwidth * efficiency / active_weight_gb) * run_mode_factor;
    raw_tps.clamp(0.5, 250.0)
}

/// Evaluate memory fit, layer offloading, speed, and scoring for a catalog entry against hardware specs.
pub fn evaluate(profile: &HardwareProfile, entry: &CatalogEntry, cfg: &ServeConfig) -> FitResult {
    let host_budget = calculate_host_budget(profile);
    let (weights, kv, est_total) = estimate_total_memory_bytes(entry, cfg.context_size, cfg);
    let fits = est_total <= host_budget;

    let max_context_that_fits = calculate_max_context_that_fits(entry, profile, cfg);
    let (usable_context, is_context_constrained) = calculate_usable_context(entry, profile, cfg);
    let recommended_gpu_layers = cfg
        .n_gpu_layers
        .unwrap_or_else(|| calculate_recommended_gpu_layers(entry, profile, weights, kv));

    let speed_tps_estimate = estimate_speed_tps(entry, profile, recommended_gpu_layers);

    let score_fit = if fits && host_budget > 0 {
        let headroom_ratio = ((host_budget - est_total) as f32) / (host_budget as f32);
        (headroom_ratio * 10.0).clamp(1.0, 10.0)
    } else {
        0.0
    };

    let score_speed = (speed_tps_estimate / 6.0).clamp(1.0, 10.0);
    let score_quality = (entry.quality_tier as f32 * 2.0).clamp(1.0, 10.0);

    FitResult {
        entry: entry.clone(),
        fits,
        est_weights_bytes: weights,
        est_kv_bytes: kv,
        est_total_bytes: est_total,
        max_context_that_fits,
        usable_context,
        is_context_constrained,
        recommended_gpu_layers,
        speed_tps_estimate,
        score_fit,
        score_speed,
        score_quality,
    }
}

/// Batch evaluate an entire catalog against hardware specs and return ranked recommendations.
pub fn rank_recommendations(
    profile: &HardwareProfile,
    catalog: &[CatalogEntry],
    cfg: &ServeConfig,
) -> Vec<FitResult> {
    let mut results: Vec<FitResult> = catalog
        .iter()
        .map(|entry| evaluate(profile, entry, cfg))
        .collect();

    results.sort_by(|a, b| {
        b.fits.cmp(&a.fits).then_with(|| {
            let score_a = a.score_fit * 0.4 + a.score_speed * 0.3 + a.score_quality * 0.3;
            let score_b = b.score_fit * 0.4 + b.score_speed * 0.3 + b.score_quality * 0.3;
            score_b
                .partial_cmp(&score_a)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    });

    results
}
