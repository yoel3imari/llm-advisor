export interface CpuFeatures {
  has_avx512: boolean;
  has_avx2: boolean;
  has_avx: boolean;
  has_fma: boolean;
  has_neon: boolean;
  has_dotprod: boolean;
  has_sve: boolean;
  has_amx: boolean;
}

export interface HardwareProfile {
  cpu_name: string;
  arch: string;
  cpu_physical_cores: number;
  cpu_logical_cores: number;
  gpu_name?: string | null;
  gpu_vram_bytes?: number | null;
  has_unified_memory: boolean;
  total_ram_bytes: number;
  metal_working_set_bytes: number;
  disk_free_bytes: number;
  os_version: string;
  detected_at: string;
  gpu_bandwidth_gbps?: number | null;
  host_bandwidth_gbps?: number;
  cpu_features?: CpuFeatures | null;
  accelerator_backend?: string | null;
  driver_version?: string | null;
  power_source?: string | null;
}

export interface CatalogEntry {
  id: string;
  repo_id: string;
  filename: string;
  family: string;
  params_billions: number;
  active_params_b?: number | null;
  n_layers: number;
  n_kv_heads: number;
  head_dim: number;
  context_train: number;
  quant: string;
  file_size_bytes: number;
  sha256: string;
  gated: boolean;
  quality_tier: number;
  tags: string[];
}

export type KvType = 'f16' | 'q8_0' | 'q4_0';

export interface ServeConfig {
  context_size: number;
  n_parallel: number;
  kv_type: KvType;
  n_gpu_layers?: number | null;
}

export interface FitResult {
  entry: CatalogEntry;
  fits: boolean;
  est_weights_bytes: number;
  est_kv_bytes: number;
  est_total_bytes: number;
  max_context_that_fits: number;
  usable_context?: number;
  is_context_constrained?: boolean;
  recommended_gpu_layers: number;
  speed_tps_estimate: number;
  score_fit: number;
  score_speed: number;
  score_quality: number;
}

export type DownloadState =
  | { status: 'queued' }
  | { status: 'downloading'; bytes_done: number; total_bytes: number }
  | { status: 'verifying' }
  | { status: 'ready' }
  | { status: 'paused'; bytes_done: number; total_bytes: number }
  | { status: 'failed'; reason: string };

export interface DownloadTask {
  entry_id: string;
  state: DownloadState;
  bytes_done: number;
  bytes_total: number;
  etag: string;
  error?: string | null;
}

export interface ModelRecord {
  entry_id: string;
  file_path: string;
  size_bytes: number;
  verified: boolean;
  added_at: string;
}

export interface RunningInstanceInfo {
  model_id: string;
  model_path: string;
  port: number;
  context_size: number;
  started_at: string;
}

export type ServerState =
  | { state: 'stopped' }
  | { state: 'starting'; model_id: string; port: number; started_at: string }
  | {
      state: 'serving';
      model_id: string;
      model_path: string;
      port: number;
      context_size: number;
      started_at: string;
      instances?: RunningInstanceInfo[];
    }
  | { state: 'error'; reason: string; stderr_tail: string[] };

export interface LibraryReconciliation {
  valid_records: ModelRecord[];
  missing_records: ModelRecord[];
  orphan_files: string[];
}

export interface AppSettings {
  hf_token: string;
  gateway_port: number;
  default_context_size: number;
  default_kv_type: KvType;
  models_dir: string;
  run_in_background?: boolean;
}

export interface CleanUninstallOptions {
  delete_models?: boolean;
  clear_configs?: boolean;
  clear_cache?: boolean;
}

export interface UninstallResult {
  reclaimed_bytes: number;
  models_deleted: number;
  configs_cleared: boolean;
  cache_purged: boolean;
  app_data_dir?: string;
  success: boolean;
}

