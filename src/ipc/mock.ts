import type {
  HardwareProfile,
  CatalogEntry,
  ServeConfig,
  FitResult,
  ModelRecord,
  DownloadTask,
  ServerState,
  RunningInstanceInfo,
  LibraryReconciliation,
  AppSettings,
  CleanUninstallOptions,
  UninstallResult,
  CatalogSyncResult,
  AppUpdateInfo,
} from '../types/domain';

export const MOCK_PROFILE: HardwareProfile = {
  cpu_name: 'Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz',
  arch: 'x86_64',
  cpu_physical_cores: 8,
  cpu_logical_cores: 16,
  gpu_name: 'AMD Radeon Pro 5500M',
  gpu_vram_bytes: 4 * 1024 * 1024 * 1024,
  has_unified_memory: false,
  total_ram_bytes: 16 * 1024 * 1024 * 1024,
  metal_working_set_bytes: 12 * 1024 * 1024 * 1024,
  disk_free_bytes: 256 * 1024 * 1024 * 1024,
  os_version: 'macOS 14.5 (Sonoma)',
  detected_at: new Date().toISOString(),
  gpu_bandwidth_gbps: 192.0,
  host_bandwidth_gbps: 40.0,
};

export const MOCK_CATALOG: CatalogEntry[] = [
  {
    id: 'qwen2.5-0.5b-instruct-q4_k_m',
    repo_id: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    family: 'qwen2.5',
    params_billions: 0.49,
    n_layers: 24,
    n_kv_heads: 2,
    head_dim: 64,
    context_train: 32768,
    quant: 'Q4_K_M',
    file_size_bytes: 397737696,
    sha256: 'b6f52e5a40bf31c9a6aa49c8945391d3ecbc8b98165cf45a16d84346eb4a053c',
    gated: false,
    quality_tier: 4,
    tags: ['qwen', '0.5b', 'ultra-light'],
  },
  {
    id: 'tinyllama-1.1b-chat-q4_k_m',
    repo_id: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
    filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    family: 'tinyllama',
    params_billions: 1.1,
    n_layers: 22,
    n_kv_heads: 4,
    head_dim: 64,
    context_train: 2048,
    quant: 'Q4_K_M',
    file_size_bytes: 668614400,
    sha256: '921ab07e8ab9b7c8df4f5d5cc6133036495df0271bb8e734c568f18d7f4beaf9',
    gated: false,
    quality_tier: 4,
    tags: ['tinyllama', '1.1b', 'chat'],
  },
  {
    id: 'llama-3.2-1b-instruct-q4_k_m',
    repo_id: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    family: 'llama-3.2',
    params_billions: 1.23,
    n_layers: 16,
    n_kv_heads: 8,
    head_dim: 64,
    context_train: 131072,
    quant: 'Q4_K_M',
    file_size_bytes: 808381152,
    sha256: '677d206f3630f9227f272a8c3d97f267ec4c6c06a32cb89d5f75e2e88a0eefcf',
    gated: false,
    quality_tier: 4,
    tags: ['llama', '1b', 'instruct'],
  },
  {
    id: 'llama-3.2-3b-instruct-q4_k_m',
    repo_id: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    family: 'llama-3.2',
    params_billions: 3.21,
    n_layers: 28,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: 'Q4_K_M',
    file_size_bytes: 2019488352,
    sha256: '679f225e01dfdf686616089d8ea4f18d7f8db8ba8489721739c36fcbda5a7ffc',
    gated: false,
    quality_tier: 4,
    tags: ['llama', '3b', 'instruct'],
  },
  {
    id: 'llama-3.1-8b-instruct-q4_k_m',
    repo_id: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    filename: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    family: 'llama-3.1',
    params_billions: 8.03,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 131072,
    quant: 'Q4_K_M',
    file_size_bytes: 4920727040,
    sha256: '4b6e5b4b1df8f4a3be9e1c258f2780e8e7a0cbcfdc1f1a563ee9a9978732e4d0',
    gated: false,
    quality_tier: 4,
    tags: ['llama', '8b', 'flagship'],
    benchmarks: {
      mmlu_pro: 44.2,
      livecodebench: 32.5,
      human_eval: 72.6,
      arena_elo: 1215,
    },
  },
  {
    id: 'qwen2.5-7b-instruct-q4_k_m',
    repo_id: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
    filename: 'qwen2.5-7b-instruct-q4_k_m.gguf',
    family: 'qwen2.5',
    params_billions: 7.61,
    n_layers: 28,
    n_kv_heads: 4,
    head_dim: 128,
    context_train: 131072,
    quant: 'Q4_K_M',
    file_size_bytes: 4684949184,
    sha256: '677d206f3630f9227f272a8c3d97f267ec4c6c06a32cb89d5f75e2e88a0eefce',
    gated: false,
    quality_tier: 4,
    tags: ['qwen', '7b', 'coding'],
    benchmarks: {
      mmlu_pro: 56.4,
      livecodebench: 34.0,
      swe_bench: 39.8,
      human_eval: 84.0,
      arena_elo: 1245,
    },
  },
  {
    id: 'mixtral-8x7b-instruct-v0.1-q4_k_m',
    repo_id: 'TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF',
    filename: 'mixtral-8x7b-instruct-v0.1.Q4_K_M.gguf',
    family: 'mixtral',
    params_billions: 46.7,
    active_params_b: 12.9,
    n_layers: 32,
    n_kv_heads: 8,
    head_dim: 128,
    context_train: 32768,
    quant: 'Q4_K_M',
    file_size_bytes: 26442045696,
    sha256: 'a09ba8fa0172605eb82efd14ca2a045952c4ca70a92d24268e0d9385bf564499',
    gated: false,
    quality_tier: 4,
    tags: ['moe', '8x7b'],
  },
];

let mockRecords: ModelRecord[] = [
  {
    entry_id: 'qwen2.5-0.5b-instruct-q4_k_m',
    file_path: '/Users/demo/Library/Application Support/dev.yoel3imari.llm-advisor/models/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    size_bytes: 397737696,
    verified: true,
    added_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

let mockDownloads: DownloadTask[] = [];
let mockServerState: ServerState = { state: 'stopped' };
let mockLogs: string[] = [
  '[system] ServerManager initialized',
  '[system] Hardware profile loaded: Intel Core i9-9880H (16GB RAM, 4GB VRAM)',
];

export async function mockGetHardwareProfile(): Promise<HardwareProfile> {
  return { ...MOCK_PROFILE };
}

export async function mockRefreshHardwareProfile(): Promise<HardwareProfile> {
  return { ...MOCK_PROFILE, detected_at: new Date().toISOString() };
}

export async function mockGetCatalog(): Promise<CatalogEntry[]> {
  return [...MOCK_CATALOG];
}

export async function mockRecommendModels(cfg: ServeConfig): Promise<FitResult[]> {
  const hostBudget = Math.min(MOCK_PROFILE.metal_working_set_bytes, MOCK_PROFILE.total_ram_bytes);
  const kvElemBytes = cfg.kv_type === 'q8_0' ? 1 : 2;
  const slots = cfg.n_parallel || 1;

  return MOCK_CATALOG.map((entry) => {
    const effectiveCtx = Math.min(cfg.context_size, entry.context_train);
    const kv = 2 * entry.n_layers * entry.n_kv_heads * entry.head_dim * effectiveCtx * kvElemBytes * slots;
    const weights = entry.file_size_bytes;
    const activations = Math.ceil(weights * 0.05);
    const overhead = 700 * 1024 * 1024;
    const total = weights + kv + activations + overhead;
    const fits = total <= hostBudget;

    const layerWeight = weights / entry.n_layers;
    const layerKv = kv / entry.n_layers;
    const layerTotal = layerWeight + layerKv;
    const vramBudget = (MOCK_PROFILE.gpu_vram_bytes || 0) > 200 * 1024 * 1024
      ? (MOCK_PROFILE.gpu_vram_bytes || 0) - 200 * 1024 * 1024
      : 0;
    const recommendedLayers = Math.min(entry.n_layers, Math.floor(vramBudget / layerTotal));

    const activeParams = entry.active_params_b || entry.params_billions;
    const gpuRatio = recommendedLayers / entry.n_layers;
    const bandwidth = gpuRatio * 220.0 + (1.0 - gpuRatio) * 40.0;
    const speed = Math.max(0.5, (bandwidth * 0.65) / activeParams);

    const headroom = fits ? (hostBudget - total) / hostBudget : 0;
    const scoreFit = fits ? Math.min(10, Math.max(1, headroom * 10)) : 0;
    const scoreSpeed = Math.min(10, Math.max(1, speed / 6));
    const scoreQuality = entry.quality_tier * 2;

    const leftover = Math.max(0, hostBudget - (weights + activations + overhead));
    const bytesPerToken = 2 * entry.n_layers * entry.n_kv_heads * entry.head_dim * kvElemBytes * slots;
    const maxTokens = bytesPerToken > 0 ? Math.floor(leftover / bytesPerToken) : entry.context_train;
    const usableContext = Math.min(entry.context_train, Math.max(512, maxTokens));
    const isConstrained = usableContext < entry.context_train;

    return {
      entry,
      fits,
      est_weights_bytes: weights,
      est_kv_bytes: kv,
      est_total_bytes: total,
      max_context_that_fits: fits ? entry.context_train : 2048,
      usable_context: usableContext,
      is_context_constrained: isConstrained,
      recommended_gpu_layers: recommendedLayers,
      speed_tps_estimate: parseFloat(speed.toFixed(1)),
      score_fit: parseFloat(scoreFit.toFixed(1)),
      score_speed: parseFloat(scoreSpeed.toFixed(1)),
      score_quality: scoreQuality,
    };
  }).sort((a, b) => (b.fits === a.fits ? (b.score_fit + b.score_speed) - (a.score_fit + a.score_speed) : b.fits ? 1 : -1));
}

export async function mockListLibraryModels(): Promise<ModelRecord[]> {
  return [...mockRecords];
}

export async function mockDeleteLibraryModel(entryId: string): Promise<boolean> {
  mockRecords = mockRecords.filter((r) => r.entry_id !== entryId);
  return true;
}

export async function mockReconcileLibrary(): Promise<LibraryReconciliation> {
  return {
    valid_records: [...mockRecords],
    missing_records: [],
    orphan_files: [],
  };
}

export async function mockStartDownload(entryId: string): Promise<string> {
  const entry = MOCK_CATALOG.find((e) => e.id === entryId);
  if (!entry) throw new Error(`Model not found: ${entryId}`);

  // Prevent duplicate tasks
  if (mockDownloads.some((d) => d.entry_id === entryId)) {
    return entryId;
  }

  const task: DownloadTask = {
    entry_id: entryId,
    state: { status: 'downloading', bytes_done: 0, total_bytes: entry.file_size_bytes },
    bytes_done: 0,
    bytes_total: entry.file_size_bytes,
    etag: entry.sha256,
  };

  mockDownloads.push(task);

  // Simulate progress in mock mode
  const interval = setInterval(() => {
    const item = mockDownloads.find((d) => d.entry_id === entryId);
    if (!item) {
      clearInterval(interval);
      return;
    }
    const step = Math.ceil(entry.file_size_bytes / 5);
    item.bytes_done = Math.min(entry.file_size_bytes, item.bytes_done + step);
    item.state = { status: 'downloading', bytes_done: item.bytes_done, total_bytes: entry.file_size_bytes };
    if (item.bytes_done >= entry.file_size_bytes) {
      clearInterval(interval);
      mockDownloads = mockDownloads.filter((d) => d.entry_id !== entryId);
      if (!mockRecords.some((r) => r.entry_id === entryId)) {
        mockRecords.push({
          entry_id: entryId,
          file_path: `/models/${entryId}.gguf`,
          size_bytes: entry.file_size_bytes,
          verified: true,
          added_at: new Date().toISOString(),
        });
      }
    }
  }, 1000);

  return entryId;
}

export async function mockCancelDownload(entryId: string): Promise<boolean> {
  mockDownloads = mockDownloads.filter((d) => d.entry_id !== entryId);
  return true;
}

export async function mockGetActiveDownloads(): Promise<DownloadTask[]> {
  return [...mockDownloads];
}

export async function mockGetServerState(): Promise<ServerState> {
  return { ...mockServerState };
}

export async function mockListRunningInstances(): Promise<RunningInstanceInfo[]> {
  if (mockServerState.state === 'serving') {
    return mockServerState.instances || [
      {
        model_id: mockServerState.model_id,
        model_path: mockServerState.model_path,
        port: mockServerState.port,
        context_size: mockServerState.context_size,
        started_at: mockServerState.started_at,
      },
    ];
  }
  return [];
}

export async function mockStartServer(modelId: string, cfg: ServeConfig): Promise<number> {
  const newInst: RunningInstanceInfo = {
    model_id: modelId,
    model_path: `/models/${modelId}.gguf`,
    port: 13370,
    context_size: cfg.context_size || 4096,
    started_at: new Date().toISOString(),
  };

  const existingInsts =
    mockServerState.state === 'serving' ? mockServerState.instances || [] : [];
  const updatedInsts = [
    ...existingInsts.filter((i) => i.model_id !== modelId),
    newInst,
  ];

  mockServerState = {
    state: 'serving',
    model_id: modelId,
    model_path: `/models/${modelId}.gguf`,
    port: 13370,
    context_size: cfg.context_size || 4096,
    started_at: newInst.started_at,
    instances: updatedInsts,
  };
  mockLogs.push(`[info] Started serving model ${modelId} on port 13370`);
  return 13370;
}

export async function mockStopInstance(modelId: string): Promise<void> {
  if (mockServerState.state === 'serving') {
    const remaining = (mockServerState.instances || []).filter(
      (i) => i.model_id !== modelId
    );
    if (remaining.length === 0) {
      mockServerState = { state: 'stopped' };
    } else {
      mockServerState = {
        state: 'serving',
        model_id: remaining[0].model_id,
        model_path: remaining[0].model_path,
        port: remaining[0].port,
        context_size: remaining[0].context_size,
        started_at: remaining[0].started_at,
        instances: remaining,
      };
    }
  }
  mockLogs.push(`[info] Stopped instance ${modelId}`);
}

export async function mockStopServer(): Promise<void> {
  mockServerState = { state: 'stopped' };
  mockLogs.push(`[info] Stopped inference server`);
}

export async function mockGetServerLogs(_modelId?: string): Promise<string[]> {
  return [...mockLogs];
}

export async function mockClearServerLogs(_modelId?: string): Promise<void> {
  mockLogs = [];
}

export async function mockGetSettings(): Promise<AppSettings> {
  return {
    hf_token: '',
    gateway_port: 13370,
    default_context_size: 4096,
    default_kv_type: 'f16',
    models_dir: '~/Library/Application Support/dev.yoel3imari.llm-advisor/models',
    run_in_background: true,
    auto_update_catalog: true,
    catalog_endpoint: 'https://raw.githubusercontent.com/yoel3imari/llm-advisor/main/crates/catalog/catalog.json',
  };
}

export async function mockSaveSettings(_settings: AppSettings): Promise<void> {
  // no-op in mock
}

export async function mockSyncCatalog(): Promise<CatalogSyncResult> {
  await new Promise((r) => setTimeout(r, 100));
  return {
    status: 'Updated',
    details: {
      count: MOCK_CATALOG.length,
      etag: 'mock-etag-v1',
    },
  };
}

export async function mockPurgeAllModels(): Promise<number> {
  mockRecords = [];
  mockDownloads = [];
  return 0;
}

export async function mockFactoryReset(): Promise<boolean> {
  mockRecords = [];
  mockDownloads = [];
  mockServerState = { state: 'stopped' };
  mockLogs = [];
  return true;
}

export async function mockCleanUninstall(options?: CleanUninstallOptions): Promise<UninstallResult> {
  const reclaimed = mockRecords.reduce((acc, r) => acc + (r.size_bytes || 0), 0);
  const modelsCount = mockRecords.length;

  if (options?.delete_models !== false) {
    mockRecords = [];
    mockDownloads = [];
  }
  if (options?.clear_configs !== false) {
    // Reset configuration
  }
  if (options?.clear_cache !== false) {
    mockLogs = [];
  }
  mockServerState = { state: 'stopped' };

  return {
    reclaimed_bytes: reclaimed,
    models_deleted: modelsCount,
    configs_cleared: options?.clear_configs !== false,
    cache_purged: options?.clear_cache !== false,
    app_data_dir: '/Users/demo/Library/Application Support/dev.yoel3imari.llm-advisor',
    success: true,
  };
}

export async function mockPruneOrphans(orphans: string[]): Promise<number> {
  return orphans.length;
}

export async function mockCheckAppUpdate(): Promise<AppUpdateInfo> {
  await new Promise((r) => setTimeout(r, 150));
  return {
    current_version: '0.1.0',
    latest_version: '0.1.0',
    update_available: false,
    release_notes: undefined,
    pub_date: undefined,
  };
}

export async function mockInstallAppUpdate(): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 200));
  return true;
}

