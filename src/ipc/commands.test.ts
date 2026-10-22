import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mockInvoke = vi.fn();
const mockGetVersion = vi.fn();

vi.mock('@tauri-apps/api/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tauri-apps/api/core')>();
  return {
    ...actual,
    invoke: (...args: unknown[]) =>
      (mockInvoke as (...a: unknown[]) => unknown)(...args),
    Channel: class MockChannel {
      onmessage: ((msg: unknown) => void) | undefined;
      constructor() {}
    },
  };
});

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: () => mockGetVersion(),
}));

import type { ServeConfig, AppSettings, CleanUninstallOptions } from '../types/domain';

type CommandsModule = typeof import('./commands');
let commands: CommandsModule;

beforeAll(async () => {
  // Simulate running inside real Tauri webview before importing commands
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  commands = await import('./commands');
});

describe('Tauri IPC Commands Contract Verification', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockGetVersion.mockReset();
  });

  it('verifies hardware profile commands', async () => {
    mockInvoke.mockResolvedValueOnce({ arch: 'x86_64' });
    const profile = await commands.getHardwareProfile();
    expect(mockInvoke).toHaveBeenCalledWith('get_hardware_profile');
    expect(profile).toEqual({ arch: 'x86_64' });

    mockInvoke.mockResolvedValueOnce({ arch: 'aarch64' });
    const refreshed = await commands.refreshHardwareProfile();
    expect(mockInvoke).toHaveBeenCalledWith('refresh_hardware_profile');
    expect(refreshed).toEqual({ arch: 'aarch64' });
  });

  it('verifies catalog commands', async () => {
    mockInvoke.mockResolvedValueOnce([{ id: 'model-1' }]);
    const cat = await commands.getCatalog();
    expect(mockInvoke).toHaveBeenCalledWith('get_catalog');
    expect(cat).toHaveLength(1);

    mockInvoke.mockResolvedValueOnce({ status: 'up_to_date' });
    const syncRes = await commands.syncCatalog();
    expect(mockInvoke).toHaveBeenCalledWith('sync_catalog');
    expect(syncRes).toEqual({ status: 'up_to_date' });
  });

  it('verifies recommend_models command passes cfg payload', async () => {
    const cfg: ServeConfig = {
      context_size: 4096,
      n_parallel: 1,
      kv_type: 'f16',
      n_gpu_layers: 99,
    };
    mockInvoke.mockResolvedValueOnce([]);
    await commands.recommendModels(cfg);
    expect(mockInvoke).toHaveBeenCalledWith('recommend_models', { cfg });
  });

  it('verifies library commands and parameter serialization', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await commands.listLibraryModels();
    expect(mockInvoke).toHaveBeenCalledWith('list_library_models');

    mockInvoke.mockResolvedValueOnce(true);
    await commands.deleteLibraryModel('test-entry-id');
    expect(mockInvoke).toHaveBeenCalledWith('delete_library_model', {
      entryId: 'test-entry-id',
    });

    mockInvoke.mockResolvedValueOnce({ reconciled: [], orphaned: [], missing: [] });
    await commands.reconcileLibrary();
    expect(mockInvoke).toHaveBeenCalledWith('reconcile_library');
  });

  it('verifies download commands and cancellation', async () => {
    mockInvoke.mockResolvedValueOnce('model-entry-1');
    const dlId = await commands.startDownload('model-entry-1');
    expect(mockInvoke).toHaveBeenCalledWith('start_download', {
      entryId: 'model-entry-1',
    });
    expect(dlId).toBe('model-entry-1');

    mockInvoke.mockResolvedValueOnce(true);
    const cancelled = await commands.cancelDownload('model-entry-1');
    expect(mockInvoke).toHaveBeenCalledWith('cancel_download', {
      entryId: 'model-entry-1',
    });
    expect(cancelled).toBe(true);

    mockInvoke.mockResolvedValueOnce([]);
    await commands.getActiveDownloads();
    expect(mockInvoke).toHaveBeenCalledWith('get_active_downloads');
  });

  it('verifies server lifecycle and instance management commands', async () => {
    mockInvoke.mockResolvedValueOnce({ state: 'stopped' });
    await commands.getServerState();
    expect(mockInvoke).toHaveBeenCalledWith('get_server_state');

    mockInvoke.mockResolvedValueOnce([]);
    await commands.listRunningInstances();
    expect(mockInvoke).toHaveBeenCalledWith('list_running_instances');

    const cfg: ServeConfig = {
      context_size: 2048,
      n_parallel: 2,
      kv_type: 'q8_0',
      n_gpu_layers: 33,
    };
    mockInvoke.mockResolvedValueOnce(18080);
    const port = await commands.startServer('test-model', cfg);
    expect(mockInvoke).toHaveBeenCalledWith('start_server', {
      modelId: 'test-model',
      cfg,
    });
    expect(port).toBe(18080);

    mockInvoke.mockResolvedValueOnce(undefined);
    await commands.stopServer();
    expect(mockInvoke).toHaveBeenCalledWith('stop_server');

    mockInvoke.mockResolvedValueOnce(undefined);
    await commands.stopInstance('test-model');
    expect(mockInvoke).toHaveBeenCalledWith('stop_instance', {
      modelId: 'test-model',
    });
  });

  it('verifies server log retrieval and clearing', async () => {
    mockInvoke.mockResolvedValueOnce(['log line 1', 'log line 2']);
    const logs = await commands.getServerLogs('model-a');
    expect(mockInvoke).toHaveBeenCalledWith('get_server_logs', {
      modelId: 'model-a',
    });
    expect(logs).toHaveLength(2);

    mockInvoke.mockResolvedValueOnce(undefined);
    await commands.clearServerLogs('model-a');
    expect(mockInvoke).toHaveBeenCalledWith('clear_server_logs', {
      modelId: 'model-a',
    });
  });

  it('verifies settings, maintenance and uninstall commands', async () => {
    const dummySettings: AppSettings = {
      hf_token: 'hf_test_token',
      gateway_port: 13370,
      default_context_size: 4096,
      default_kv_type: 'f16',
      models_dir: '/tmp/models',
      run_in_background: true,
      auto_update_catalog: true,
      catalog_endpoint: 'https://example.com/catalog.json',
      theme: 'dark',
    };

    mockInvoke.mockResolvedValueOnce(dummySettings);
    const settings = await commands.getSettings();
    expect(mockInvoke).toHaveBeenCalledWith('get_settings');
    expect(settings.hf_token).toBe('hf_test_token');

    mockInvoke.mockResolvedValueOnce(undefined);
    await commands.saveSettings(dummySettings);
    expect(mockInvoke).toHaveBeenCalledWith('save_settings', {
      settings: dummySettings,
    });

    mockInvoke.mockResolvedValueOnce(102400);
    const purgedBytes = await commands.purgeAllModels();
    expect(mockInvoke).toHaveBeenCalledWith('purge_all_models');
    expect(purgedBytes).toBe(102400);

    mockInvoke.mockResolvedValueOnce(true);
    await commands.factoryReset();
    expect(mockInvoke).toHaveBeenCalledWith('factory_reset');

    const uninstallOpts: CleanUninstallOptions = {
      delete_models: true,
      clear_configs: true,
      clear_cache: true,
    };
    mockInvoke.mockResolvedValueOnce({
      reclaimed_bytes: 5000,
      models_deleted: 2,
      configs_cleared: true,
      cache_purged: true,
      app_data_dir: '/tmp',
      success: true,
    });
    const uninstRes = await commands.cleanUninstall(uninstallOpts);
    expect(mockInvoke).toHaveBeenCalledWith('clean_uninstall', {
      options: uninstallOpts,
    });
    expect(uninstRes.success).toBe(true);

    mockInvoke.mockResolvedValueOnce(3);
    const prunedCount = await commands.pruneOrphans(['/tmp/orphan.gguf']);
    expect(mockInvoke).toHaveBeenCalledWith('prune_orphans', {
      orphans: ['/tmp/orphan.gguf'],
    });
    expect(prunedCount).toBe(3);
  });

  it('verifies updater and app version commands', async () => {
    mockInvoke.mockResolvedValueOnce({
      current_version: '0.2.4',
      latest_version: '0.2.5',
      update_available: true,
    });
    const updateInfo = await commands.checkAppUpdate();
    expect(mockInvoke).toHaveBeenCalledWith('check_app_update');
    expect(updateInfo.update_available).toBe(true);

    mockInvoke.mockResolvedValueOnce(true);
    const installed = await commands.installAppUpdate();
    expect(mockInvoke).toHaveBeenCalledWith('install_app_update');
    expect(installed).toBe(true);

    mockGetVersion.mockResolvedValueOnce('0.2.4');
    const version = await commands.getAppVersion();
    expect(mockGetVersion).toHaveBeenCalledTimes(1);
    expect(version).toBe('0.2.4');
  });
});
