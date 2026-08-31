import { invoke } from '@tauri-apps/api/core';
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
} from '../types/domain';
import * as mock from './mock';

// Detect if running inside Tauri webview or mock browser environment
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const forceMock = typeof import.meta !== 'undefined' && (import.meta as Record<string, any>).env?.VITE_MOCK_IPC === '1';
const useMock = forceMock || !isTauri;

export async function getHardwareProfile(): Promise<HardwareProfile> {
  if (useMock) return mock.mockGetHardwareProfile();
  return invoke<HardwareProfile>('get_hardware_profile');
}

export async function refreshHardwareProfile(): Promise<HardwareProfile> {
  if (useMock) return mock.mockRefreshHardwareProfile();
  return invoke<HardwareProfile>('refresh_hardware_profile');
}

export async function getCatalog(): Promise<CatalogEntry[]> {
  if (useMock) return mock.mockGetCatalog();
  return invoke<CatalogEntry[]>('get_catalog');
}

export async function recommendModels(cfg: ServeConfig): Promise<FitResult[]> {
  if (useMock) return mock.mockRecommendModels(cfg);
  return invoke<FitResult[]>('recommend_models', { cfg });
}

export async function listLibraryModels(): Promise<ModelRecord[]> {
  if (useMock) return mock.mockListLibraryModels();
  return invoke<ModelRecord[]>('list_library_models');
}

export async function deleteLibraryModel(entryId: string): Promise<boolean> {
  if (useMock) return mock.mockDeleteLibraryModel(entryId);
  return invoke<boolean>('delete_library_model', { entryId });
}

export async function reconcileLibrary(): Promise<LibraryReconciliation> {
  if (useMock) return mock.mockReconcileLibrary();
  return invoke<LibraryReconciliation>('reconcile_library');
}

export async function startDownload(entryId: string): Promise<string> {
  if (useMock) return mock.mockStartDownload(entryId);
  return invoke<string>('start_download', { entryId });
}

export async function cancelDownload(entryId: string): Promise<boolean> {
  if (useMock) return mock.mockCancelDownload(entryId);
  return invoke<boolean>('cancel_download', { entryId });
}

export async function getActiveDownloads(): Promise<DownloadTask[]> {
  if (useMock) return mock.mockGetActiveDownloads();
  return invoke<DownloadTask[]>('get_active_downloads');
}

export async function getServerState(): Promise<ServerState> {
  if (useMock) return mock.mockGetServerState();
  return invoke<ServerState>('get_server_state');
}

export async function listRunningInstances(): Promise<RunningInstanceInfo[]> {
  if (useMock) return mock.mockListRunningInstances();
  return invoke<RunningInstanceInfo[]>('list_running_instances');
}

export async function startServer(modelId: string, cfg: ServeConfig): Promise<number> {
  if (useMock) return mock.mockStartServer(modelId, cfg);
  return invoke<number>('start_server', { modelId, cfg });
}

export async function stopServer(): Promise<void> {
  if (useMock) return mock.mockStopServer();
  return invoke<void>('stop_server');
}

export async function stopInstance(modelId: string): Promise<void> {
  if (useMock) return mock.mockStopInstance(modelId);
  return invoke<void>('stop_instance', { modelId });
}

export async function getServerLogs(modelId?: string): Promise<string[]> {
  if (useMock) return mock.mockGetServerLogs(modelId);
  return invoke<string[]>('get_server_logs', { modelId });
}

export async function getSettings(): Promise<AppSettings> {
  if (useMock) return mock.mockGetSettings();
  return invoke<AppSettings>('get_settings');
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (useMock) return mock.mockSaveSettings(settings);
  return invoke<void>('save_settings', { settings });
}

export async function purgeAllModels(): Promise<number> {
  if (useMock) return mock.mockPurgeAllModels();
  return invoke<number>('purge_all_models');
}

export async function factoryReset(): Promise<boolean> {
  if (useMock) return mock.mockFactoryReset();
  return invoke<boolean>('factory_reset');
}

export async function cleanUninstall(options?: CleanUninstallOptions): Promise<UninstallResult> {
  if (useMock) return mock.mockCleanUninstall(options);
  return invoke<UninstallResult>('clean_uninstall', { options });
}

export async function pruneOrphans(orphans: string[]): Promise<number> {
  if (useMock) return mock.mockPruneOrphans(orphans);
  return invoke<number>('prune_orphans', { orphans });
}

