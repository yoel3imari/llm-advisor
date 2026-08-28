import { useState, useEffect } from 'react';
import {
  KeyRound,
  Network,
  Folder,
  Save,
  Check,
  Minimize2,
  HardDrive,
  Trash2,
  RotateCcw,
  Info,
} from 'lucide-react';
import type { AppSettings, ModelRecord } from '../types/domain';
import {
  getSettings,
  saveSettings,
  purgeAllModels,
  factoryReset,
  listLibraryModels,
} from '../ipc/commands';
import { DeleteConfirmDialog } from '../components/ui/DeleteConfirmDialog';

interface Props {
  onSettingsChanged?: () => void;
}

export function SettingsView({ onSettingsChanged }: Props) {
  const [settings, setSettings] = useState<AppSettings>({
    hf_token: '',
    gateway_port: 13370,
    default_context_size: 4096,
    default_kv_type: 'f16',
    models_dir: '~/Library/Application Support/dev.portfolio.local-llm-advisor/models',
    run_in_background: true,
  });
  const [records, setRecords] = useState<ModelRecord[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [s, recs] = await Promise.all([getSettings(), listLibraryModels()]);
      setSettings(s);
      setRecords(recs);
    } catch (err) {
      console.error('Failed to load settings data', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalBytes = records.reduce((acc, r) => acc + (r.size_bytes || 0), 0);
  const formatGb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSettingsChanged?.();
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeAll = async () => {
    try {
      await purgeAllModels();
      setActionNotice('Successfully purged all downloaded models.');
      await loadData();
      onSettingsChanged?.();
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      console.error('Failed to purge models', err);
    }
  };

  const handleFactoryReset = async () => {
    try {
      await factoryReset();
      setActionNotice('Factory reset complete. Application returned to default state.');
      await loadData();
      onSettingsChanged?.();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error('Failed to factory reset', err);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Application Settings</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Configure API credentials, background execution, and storage management
        </p>
      </div>

      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      <div className="space-y-5 text-sm">
        {/* Background Execution & Tray */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold">
            <Minimize2 className="w-4 h-4" />
            <h3 className="text-white">Background Execution & System Tray</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Allow the OpenAI-compatible gateway (<code className="text-zinc-300">127.0.0.1:13370</code>) and inference server to keep serving developer tools in the background when the main window is closed.
          </p>
          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={settings.run_in_background ?? true}
              onChange={(e) =>
                setSettings({ ...settings, run_in_background: e.target.checked })
              }
              className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-zinc-900"
            />
            <span className="text-xs font-medium text-zinc-200">
              Keep server running in background when window is closed (hide to system tray)
            </span>
          </label>
        </div>

        {/* HuggingFace Token */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold">
            <KeyRound className="w-4 h-4" />
            <h3 className="text-white">Hugging Face Access Token</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Required for downloading gated model families (such as Meta Llama 3.1 & 3.3). Stored securely in OS keychain.
          </p>
          <input
            type="password"
            placeholder="hf_..."
            value={settings.hf_token}
            onChange={(e) => setSettings({ ...settings, hf_token: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Network & Gateway Port */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold">
            <Network className="w-4 h-4" />
            <h3 className="text-white">Gateway Network Configuration</h3>
          </div>
          <p className="text-xs text-zinc-400">
            The OpenAI-compatible gateway binds strictly to loopback (<code className="text-zinc-300">127.0.0.1</code>) for safety.
          </p>
          <div className="flex items-center gap-4">
            <label className="text-xs text-zinc-300 font-medium">Gateway Port:</label>
            <input
              type="number"
              value={settings.gateway_port}
              onChange={(e) =>
                setSettings({ ...settings, gateway_port: parseInt(e.target.value) || 13370 })
              }
              className="w-32 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Storage Location */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <Folder className="w-4 h-4" />
            <h3 className="text-white">Models Storage Path</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Directory where downloaded GGUF weights are kept. Can be placed on external fast NVMe/Thunderbolt drives.
          </p>
          <input
            type="text"
            value={settings.models_dir}
            onChange={(e) => setSettings({ ...settings, models_dir: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition-colors disabled:opacity-50"
          >
            {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Preferences'}
          </button>
        </div>

        {/* Storage & Cleanup Tools */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <HardDrive className="w-4 h-4" />
              <h3 className="text-white">Storage Management & Reclaim</h3>
            </div>
            <span className="text-xs font-mono text-zinc-300 bg-zinc-800 px-2.5 py-1 rounded-md">
              {formatGb(totalBytes)} GB used ({records.length} models)
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            GGUF model weights occupy significant disk space. Reclaim storage by purging unneeded models or resetting all state.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => setPurgeOpen(true)}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              Purge All Downloaded Models
            </button>

            <button
              onClick={() => setResetOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
              Factory Reset & Clean State
            </button>
          </div>
        </div>

        {/* Clean Uninstallation Guide */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-zinc-400 font-semibold">
            <Info className="w-4 h-4" />
            <h3 className="text-zinc-200">Uninstalling Local LLM Advisor</h3>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Standard app removal may leave multi-GB model weights in your OS application support directory. To ensure a 100% clean uninstall:
          </p>
          <ol className="list-decimal list-inside text-xs text-zinc-400 space-y-1 pl-1">
            <li>Click <strong>"Factory Reset & Clean State"</strong> above to delete all downloaded model weights and saved tokens.</li>
            <li>Delete the application executable / bundle from your Applications or Program Files folder.</li>
          </ol>
        </div>
      </div>

      {/* Confirmation Modals */}
      <DeleteConfirmDialog
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
        modelId={`All ${records.length} Downloaded Models`}
        sizeBytes={totalBytes}
        title="Purge All Model Weights"
        description="Are you sure you want to delete all downloaded models from disk? This will immediately free up disk space. Your settings and API keys will be preserved."
        confirmButtonText="Purge All Models"
        onConfirm={handlePurgeAll}
      />

      <DeleteConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        modelId="Factory Reset (All Models + Credentials + Configurations)"
        sizeBytes={totalBytes}
        title="Factory Reset & Clean All Data"
        description="This action will stop all running servers, delete all downloaded model files from disk, clear your Hugging Face credentials, and restore all settings to defaults. This cannot be undone."
        confirmButtonText="Execute Factory Reset"
        onConfirm={handleFactoryReset}
      />
    </div>
  );
}
