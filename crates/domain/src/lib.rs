//! Core domain types and error taxonomy for Local LLM Advisor.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

/// Helper wrapper for byte counts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
pub struct Bytes(pub u64);

impl Bytes {
    pub fn as_u64(&self) -> u64 {
        self.0
    }

    pub fn to_gb(&self) -> f64 {
        self.0 as f64 / (1024.0 * 1024.0 * 1024.0)
    }

    pub fn to_mb(&self) -> f64 {
        self.0 as f64 / (1024.0 * 1024.0)
    }
}

/// CPU SIMD instruction set features detected at runtime.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct CpuFeatures {
    pub has_avx512: bool,
    pub has_avx2: bool,
    pub has_avx: bool,
    pub has_fma: bool,
    pub has_neon: bool,
    pub has_dotprod: bool,
    pub has_sve: bool,
    pub has_amx: bool,
}

/// Hardware profile detected on the host system.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HardwareProfile {
    pub cpu_name: String,
    pub arch: String,
    pub cpu_physical_cores: u32,
    pub cpu_logical_cores: u32,
    pub gpu_name: Option<String>,
    pub gpu_vram_bytes: Option<u64>,
    pub has_unified_memory: bool,
    pub total_ram_bytes: u64,
    pub metal_working_set_bytes: u64,
    pub disk_free_bytes: u64,
    pub os_version: String,
    pub detected_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gpu_bandwidth_gbps: Option<f32>,
    #[serde(default = "default_host_bandwidth_gbps")]
    pub host_bandwidth_gbps: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cpu_features: Option<CpuFeatures>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accelerator_backend: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub driver_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub power_source: Option<String>,
}

impl Default for HardwareProfile {
    fn default() -> Self {
        Self {
            cpu_name: "x86_64 Processor".to_string(),
            arch: "x86_64".to_string(),
            cpu_physical_cores: 4,
            cpu_logical_cores: 8,
            gpu_name: None,
            gpu_vram_bytes: None,
            has_unified_memory: false,
            total_ram_bytes: 16 * 1024 * 1024 * 1024,
            metal_working_set_bytes: 12 * 1024 * 1024 * 1024,
            disk_free_bytes: 100 * 1024 * 1024 * 1024,
            os_version: "Generic OS".to_string(),
            detected_at: Utc::now(),
            gpu_bandwidth_gbps: None,
            host_bandwidth_gbps: 40.0,
            cpu_features: None,
            accelerator_backend: None,
            driver_version: None,
            power_source: None,
        }
    }
}

fn default_host_bandwidth_gbps() -> f32 {
    40.0
}

/// Curated catalog entry describing a GGUF model and its architecture parameters.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CatalogEntry {
    pub id: String,
    pub repo_id: String,
    pub filename: String,
    pub family: String,
    pub params_billions: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_params_b: Option<f32>,
    pub n_layers: u32,
    /// Number of Key-Value attention heads (GQA).
    /// CRITICAL: Must use n_kv_heads (e.g. 8 for Llama 3.1 8B), never total attention heads (n_head=32).
    pub n_kv_heads: u32,
    pub head_dim: u32,
    pub context_train: u32,
    pub quant: String,
    pub file_size_bytes: u64,
    pub sha256: String,
    pub gated: bool,
    pub quality_tier: u8,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// KV cache quantization type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum KvType {
    #[default]
    F16,
    Q8_0,
    Q4_0,
}

impl KvType {
    pub fn bytes_per_element(&self) -> f64 {
        match self {
            KvType::F16 => 2.0,
            KvType::Q8_0 => 1.0,
            KvType::Q4_0 => 0.5,
        }
    }
}

/// Runtime serving configuration passed to llama-server.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ServeConfig {
    #[serde(default = "default_context_size")]
    pub context_size: u32,
    #[serde(default = "default_parallel_slots")]
    pub n_parallel: u32,
    #[serde(default)]
    pub kv_type: KvType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub n_gpu_layers: Option<u32>,
}

fn default_context_size() -> u32 {
    4096
}

fn default_parallel_slots() -> u32 {
    1
}

impl Default for ServeConfig {
    fn default() -> Self {
        Self {
            context_size: default_context_size(),
            n_parallel: default_parallel_slots(),
            kv_type: KvType::default(),
            n_gpu_layers: None,
        }
    }
}

/// Mathematical memory fit evaluation result.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FitResult {
    pub entry: CatalogEntry,
    pub fits: bool,
    pub est_weights_bytes: u64,
    pub est_kv_bytes: u64,
    pub est_total_bytes: u64,
    pub max_context_that_fits: u32,
    #[serde(default)]
    pub usable_context: u32,
    #[serde(default)]
    pub is_context_constrained: bool,
    pub recommended_gpu_layers: u32,
    pub speed_tps_estimate: f32,
    pub score_fit: f32,
    pub score_speed: f32,
    pub score_quality: f32,
}

/// State of a model download task.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum DownloadState {
    Queued,
    Downloading { bytes_done: u64, total_bytes: u64 },
    Verifying,
    Ready,
    Paused { bytes_done: u64, total_bytes: u64 },
    Failed { reason: String },
}

/// Active or historical download task descriptor.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DownloadTask {
    pub entry_id: String,
    pub state: DownloadState,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub etag: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// A downloaded, verified GGUF model in the local library.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelRecord {
    pub entry_id: String,
    pub file_path: PathBuf,
    pub size_bytes: u64,
    pub verified: bool,
    pub added_at: DateTime<Utc>,
}

/// Metadata describing a running model instance in the multi-sidecar pool.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RunningInstanceInfo {
    pub model_id: String,
    pub model_path: PathBuf,
    pub port: u16,
    pub context_size: u32,
    pub started_at: DateTime<Utc>,
}

/// App-wide typed error taxonomy with user-presentable messages.
#[derive(Debug, Error, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum AppError {
    #[error("Hardware probe failed: {0}")]
    HwProbe(String),

    #[error("Catalog parsing error: {0}")]
    CatalogParse(String),

    #[error("Download network error: {0}")]
    DownloadNetwork(String),

    #[error("Download checksum mismatch: expected {expected}, actual {actual}")]
    DownloadChecksum { expected: String, actual: String },

    #[error("Insufficient disk space: required {required} bytes, available {available} bytes")]
    DownloadDiskFull { required: u64, available: u64 },

    #[error("Model is gated on HuggingFace. Please configure your HuggingFace token in Settings.")]
    DownloadGatedNoToken,

    #[error("Failed to spawn inference sidecar: {0}")]
    ServerSpawn(String),

    #[error("Inference server failed to become healthy within timeout")]
    ServerHealthTimeout,

    #[error("Failed to bind server port: {0}")]
    ServerPortBind(String),

    #[error("Inference server crashed: {0}")]
    ServerCrash(String),

    #[error("No model is currently being served")]
    ServerNotServing,

    #[error("Gateway error: {0}")]
    Gateway(String),

    #[error("Unsupported platform: {0}")]
    UnsupportedPlatform(String),

    #[error("I/O error: {0}")]
    Io(String),

    #[error("JSON serialization error: {0}")]
    Json(String),
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Json(err.to_string())
    }
}
