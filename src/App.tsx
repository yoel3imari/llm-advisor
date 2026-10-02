import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, type NavTab } from './components/layout/Sidebar';
import {
  ChatView,
  DashboardView,
  LibraryView,
  ServerView,
  SettingsView,
} from './views';
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
  getSettings,
  checkAppUpdate,
} from './ipc/commands';
import type { HardwareProfile, ModelRecord, DownloadTask, ServerState, AppSettings, AppUpdateInfo } from './types/domain';
import { getStoredTheme, applyTheme } from './lib/theme';
import { isTauriEnvironment } from './lib/utils';
import { UpdateDialog } from './components/ui/UpdateDialog';

function isDeepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  const [profile, setProfile] = useState<HardwareProfile | null>(null);
  const [libraryRecords, setLibraryRecords] = useState<ModelRecord[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<DownloadTask[]>([]);
  const [serverState, setServerState] = useState<ServerState>({ state: 'stopped' });
  const [targetServerModel, setTargetServerModel] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const { showToast } = useToast();

  // Reset main container scroll position on tab change to prevent any offset retention
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Initial mount: load hardware profile, sync theme, check for updates, and initial state
  useEffect(() => {
    // 1. Initialize and sync theme & settings
    const storedTheme = getStoredTheme();
    applyTheme(storedTheme);
    getSettings()
      .then((s) => {
        setSettings(s);
        if (s.theme && s.theme !== storedTheme) {
          applyTheme(s.theme);
        }
      })
      .catch(() => {});

    // 2. Hardware profile
    getHardwareProfile()
      .then((p) => setProfile(p))
      .catch((e) => setError(e.toString()));

    // 3. Check for application update on startup
    checkAppUpdate()
      .then((info) => {
        if (info && info.update_available) {
          setAvailableUpdate(info);
          setShowUpdateModal(true);
        }
      })
      .catch((e) => {
        console.debug('Startup update check skipped or failed:', e);
      });

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
      const [lib, dl, srv, sett] = await Promise.all([
        listLibraryModels().catch(() => []),
        getActiveDownloads().catch(() => []),
        getServerState().catch(() => ({ state: 'stopped' as const })),
        getSettings().catch(() => null),
      ]);

      setLibraryRecords((prev) => (isDeepEqual(prev, lib) ? prev : lib));
      setActiveDownloads((prev) => (isDeepEqual(prev, dl) ? prev : dl));
      setServerState((prev) => (isDeepEqual(prev, srv) ? prev : srv));
      if (sett) {
        setSettings((prev) => (isDeepEqual(prev, sett) ? prev : sett));
      }
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
    let unlistenSettings: (() => void) | undefined;

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

        unlistenSettings = await listen<AppSettings>('settings-changed', (event) => {
          if (event.payload) {
            setSettings((prev) => (isDeepEqual(prev, event.payload) ? prev : event.payload));
            if (event.payload.theme) {
              applyTheme(event.payload.theme);
            }
          }
        });
      } catch (err) {
        console.debug('Tauri event listeners inactive in mock context:', err);
      }
    })();

    return () => {
      unlistenComplete?.();
      unlistenFailed?.();
      unlistenSettings?.();
    };
  }, [refreshDynamicState, showToast, handleNavigateToServer]);

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased overflow-hidden font-sans selection:bg-indigo-500/20 selection:text-indigo-900 dark:selection:text-white">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        serverState={serverState}
        activeDownloads={activeDownloads}
        onCancelDownload={handleCancelDownload}
      />

      <main ref={mainRef} className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 w-[420px] h-[420px] bg-violet-500/10 dark:bg-violet-600/15 rounded-full blur-3xl" />
        </div>
        <div
          className={`h-full w-full flex flex-col min-h-0 ${activeTab === 'chat' ? '' : 'hidden'}`}
          aria-hidden={activeTab !== 'chat'}
        >
          <ChatView
            modelId={
              serverState.state === 'serving' ? serverState.model_id : null
            }
            isActive={activeTab === 'chat'}
            libraryRecords={libraryRecords}
          />
        </div>
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
            gatewayPort={settings?.gateway_port ?? 13370}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView onSettingsChanged={refreshDynamicState} />
        )}
      </main>

      <UpdateDialog
        open={showUpdateModal}
        onOpenChange={setShowUpdateModal}
        updateInfo={availableUpdate}
      />
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
