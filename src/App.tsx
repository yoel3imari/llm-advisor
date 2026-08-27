import { useState, useEffect } from 'react';
import { Sidebar, type NavTab } from './components/layout/Sidebar';
import { DashboardView } from './views/DashboardView';
import { LibraryView } from './views/LibraryView';
import { ServerView } from './views/ServerView';
import { SettingsView } from './views/SettingsView';
import {
  getHardwareProfile,
  listLibraryModels,
  getActiveDownloads,
  getServerState,
} from './ipc/commands';
import type { HardwareProfile, ModelRecord, DownloadTask, ServerState } from './types/domain';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [profile, setProfile] = useState<HardwareProfile | null>(null);
  const [libraryRecords, setLibraryRecords] = useState<ModelRecord[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<DownloadTask[]>([]);
  const [serverState, setServerState] = useState<ServerState>({ state: 'stopped' });
  const [targetServerModel, setTargetServerModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAllState = async () => {
    try {
      const [p, lib, dl, srv] = await Promise.all([
        getHardwareProfile().catch((e) => {
          setError(e.toString());
          return null;
        }),
        listLibraryModels().catch(() => []),
        getActiveDownloads().catch(() => []),
        getServerState().catch(() => ({ state: 'stopped' as const })),
      ]);

      if (p) setProfile(p);
      setLibraryRecords(lib);
      setActiveDownloads(dl);
      setServerState(srv);
    } catch (err: unknown) {
      setError(String(err));
    }
  };

  useEffect(() => {
    refreshAllState();
    const interval = setInterval(refreshAllState, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigateToServer = (modelId: string) => {
    setTargetServerModel(modelId);
    setActiveTab('server');
  };

  return (
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
            onModelDownloaded={refreshAllState}
            onNavigateToServer={handleNavigateToServer}
            error={error}
          />
        )}
        {activeTab === 'library' && (
          <LibraryView
            records={libraryRecords}
            activeDownloads={activeDownloads}
            onRefreshLibrary={refreshAllState}
            onNavigateToServer={handleNavigateToServer}
          />
        )}
        {activeTab === 'server' && (
          <ServerView
            serverState={serverState}
            libraryRecords={libraryRecords}
            initialSelectedModelId={targetServerModel}
            onRefreshState={refreshAllState}
          />
        )}
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
