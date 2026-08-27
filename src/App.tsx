import { useState, useEffect, useCallback } from 'react';
import { Sidebar, type NavTab } from './components/layout/Sidebar';
import { DashboardView } from './views/DashboardView';
import { LibraryView } from './views/LibraryView';
import { ServerView } from './views/ServerView';
import { SettingsView } from './views/SettingsView';
import { TooltipProvider } from './components/ui/Tooltip';
import {
  getHardwareProfile,
  listLibraryModels,
  getActiveDownloads,
  getServerState,
} from './ipc/commands';
import type { HardwareProfile, ModelRecord, DownloadTask, ServerState } from './types/domain';

function isDeepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [profile, setProfile] = useState<HardwareProfile | null>(null);
  const [libraryRecords, setLibraryRecords] = useState<ModelRecord[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<DownloadTask[]>([]);
  const [serverState, setServerState] = useState<ServerState>({ state: 'stopped' });
  const [targetServerModel, setTargetServerModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial mount: load hardware profile and initial state
  useEffect(() => {
    getHardwareProfile()
      .then((p) => setProfile(p))
      .catch((e) => setError(e.toString()));
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
    const interval = setInterval(refreshDynamicState, 3000);
    return () => clearInterval(interval);
  }, [refreshDynamicState]);

  const handleNavigateToServer = (modelId: string) => {
    setTargetServerModel(modelId);
    setActiveTab('server');
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 antialiased overflow-hidden font-sans">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        serverState={serverState}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 overflow-hidden">
        {activeTab === 'dashboard' && (
          <DashboardView
            profile={profile}
            libraryRecords={libraryRecords}
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
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
    </TooltipProvider>
  );
}
