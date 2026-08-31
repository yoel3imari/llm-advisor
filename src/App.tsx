import { useState, useEffect, useCallback } from 'react';
import { Sidebar, type NavTab } from './components/layout/Sidebar';
import { DashboardView } from './views/DashboardView';
import { LibraryView } from './views/LibraryView';
import { ServerView } from './views/ServerView';
import { SettingsView } from './views/SettingsView';
import { TooltipProvider } from './components/ui/Tooltip';
import { ToastProvider, useToast } from './components/ui/Toast';
import { listen } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import {
  getHardwareProfile,
  listLibraryModels,
  getActiveDownloads,
  getServerState,
  cancelDownload,
} from './ipc/commands';
import type { HardwareProfile, ModelRecord, DownloadTask, ServerState } from './types/domain';

function isDeepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [profile, setProfile] = useState<HardwareProfile | null>(null);
  const [libraryRecords, setLibraryRecords] = useState<ModelRecord[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<DownloadTask[]>([]);
  const [serverState, setServerState] = useState<ServerState>({ state: 'stopped' });
  const [targetServerModel, setTargetServerModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { showToast } = useToast();

  // Initial mount: load hardware profile and initial state
  useEffect(() => {
    getHardwareProfile()
      .then((p) => setProfile(p))
      .catch((e) => setError(e.toString()));

    // Request notification permission if running inside Tauri
    if (isTauriEnvironment()) {
      (async () => {
        try {
          let granted = await isPermissionGranted();
          if (!granted) {
            const permission = await requestPermission();
            granted = permission === 'granted';
          }
        } catch {
          // Ignore if notifications not permitted
        }
      })();
    }
  }, []);

  const refreshDynamicState = useCallback(async () => {
    try {
      const [lib, dl, srv] = await Promise.all([
        listLibraryModels().catch(() => []),
        getActiveDownloads().catch(() => []),
        getServerState().catch(() => ({ state: 'stopped' as const })),
      ]);

      setLibraryRecords((prev) => (isDeepEqual(prev, lib) ? prev : lib));
      setActiveDownloads((prev) => (isDeepEqual(prev, dl) ? prev : dl));
      setServerState((prev) => (isDeepEqual(prev, srv) ? prev : srv));
    } catch (err: unknown) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    refreshDynamicState();
    // Fast polling (1s) when downloads are active for smooth progress bars; standard 3s when idle
    const pollIntervalMs = activeDownloads.length > 0 ? 1000 : 3000;
    const interval = setInterval(refreshDynamicState, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refreshDynamicState, activeDownloads.length]);

  const handleNavigateToServer = useCallback((modelId: string) => {
    setTargetServerModel(modelId);
    setActiveTab('server');
  }, []);

  const handleCancelDownload = useCallback(async (entryId: string) => {
    try {
      await cancelDownload(entryId);
      refreshDynamicState();
    } catch (err) {
      console.error('Failed to cancel download', err);
    }
  }, [refreshDynamicState]);

  // Listen for backend download completion/failure events to fire in-app toasts
  useEffect(() => {
    if (!isTauriEnvironment()) return;

    let unlistenComplete: (() => void) | undefined;
    let unlistenFailed: (() => void) | undefined;

    (async () => {
      try {
        unlistenComplete = await listen<{
          entry_id: string;
          filename?: string;
          size_bytes?: number;
        }>('download-complete', (event) => {
          refreshDynamicState();
          showToast({
            type: 'success',
            title: 'Download Complete',
            description: `Model '${event.payload.entry_id}' is verified and ready to run.`,
            actionLabel: 'Serve Model',
            onAction: () => handleNavigateToServer(event.payload.entry_id),
            durationMs: 8000,
          });
        });

        unlistenFailed = await listen<{
          entry_id: string;
          reason: string;
        }>('download-failed', (event) => {
          refreshDynamicState();
          showToast({
            type: 'error',
            title: 'Download Failed',
            description: `Failed to download '${event.payload.entry_id}': ${event.payload.reason}`,
            durationMs: 10000,
          });
        });
      } catch (err) {
        console.debug('Tauri event listeners inactive in mock context:', err);
      }
    })();

    return () => {
      unlistenComplete?.();
      unlistenFailed?.();
    };
  }, [refreshDynamicState, showToast, handleNavigateToServer]);

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 antialiased overflow-hidden font-sans">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        serverState={serverState}
        activeDownloads={activeDownloads}
        onCancelDownload={handleCancelDownload}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 overflow-hidden">
        {activeTab === 'dashboard' && (
          <DashboardView
            profile={profile}
            libraryRecords={libraryRecords}
            activeDownloads={activeDownloads}
            onProfileUpdated={setProfile}
            onModelDownloaded={refreshDynamicState}
            onNavigateToServer={handleNavigateToServer}
            error={error}
          />
        )}
        {activeTab === 'library' && (
          <LibraryView
            records={libraryRecords}
            activeDownloads={activeDownloads}
            onRefreshLibrary={refreshDynamicState}
            onNavigateToServer={handleNavigateToServer}
          />
        )}
        {activeTab === 'server' && (
          <ServerView
            serverState={serverState}
            libraryRecords={libraryRecords}
            initialSelectedModelId={targetServerModel}
            onRefreshState={refreshDynamicState}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView onSettingsChanged={refreshDynamicState} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </TooltipProvider>
  );
}
