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
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  SlidersHorizontal,
  Layers,
  RefreshCw,
  Info,
  CheckCircle2,
  Globe,
  ArrowUpCircle,
  ArrowDownToLine,
} from 'lucide-react';
import type { AppSettings, ModelRecord, KvType, HardwareProfile, AppUpdateInfo } from '../types/domain';
import {
  getSettings,
  saveSettings,
  purgeAllModels,
  factoryReset,
  listLibraryModels,
  getHardwareProfile,
  reconcileLibrary,
  pruneOrphans,
  syncCatalog,
  checkAppUpdate,
  installAppUpdate,
} from '../ipc/commands';
import { CheckboxField } from '../components/ui/Checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/Select';
import { DeleteConfirmDialog } from '../components/ui/DeleteConfirmDialog';
import { UninstallDialog } from '../components/ui/UninstallDialog';

interface Props {
  onSettingsChanged?: () => void;
}

const CONTEXT_PRESETS = [
  { value: 2048, label: '2,048 tokens (Minimal VRAM)' },
  { value: 4096, label: '4,096 tokens (Standard default)' },
  { value: 8192, label: '8,192 tokens (Extended context)' },
  { value: 16384, label: '16,384 tokens (Long form & docs)' },
  { value: 32768, label: '32,768 tokens (Deep reasoning)' },
  { value: 65536, label: '65,536 tokens (Codebases & repos)' },
  { value: 131072, label: '131,072 tokens (Full Llama 3.x)' },
];

export function SettingsView({ onSettingsChanged }: Props) {
  const [settings, setSettings] = useState<AppSettings>({
    hf_token: '',
    gateway_port: 13370,
    default_context_size: 4096,
    default_kv_type: 'f16',
    models_dir: '~/Library/Application Support/dev.yoel3imari.llm-advisor/models',
    run_in_background: true,
    auto_update_catalog: true,
  });
  const [records, setRecords] = useState<ModelRecord[]>([]);
  const [profile, setProfile] = useState<HardwareProfile | null>(null);

  const [showToken, setShowToken] = useState(false);
  const [copiedPort, setCopiedPort] = useState(false);
  const [copiedDir, setCopiedDir] = useState(false);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [checkingAppUpdate, setCheckingAppUpdate] = useState(false);
  const [installingAppUpdate, setInstallingAppUpdate] = useState(false);
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [appUpdateNotice, setAppUpdateNotice] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const [purgeOpen, setPurgeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [uninstallOpen, setUninstallOpen] = useState(false);

  const [actionNotice, setActionNotice] = useState<{
    text: string;
    type: 'success' | 'info';
  } | null>(null);

  const loadData = async () => {
    try {
      const [s, recs, p] = await Promise.all([
        getSettings().catch(() => ({
          hf_token: '',
          gateway_port: 13370,
          default_context_size: 4096,
          default_kv_type: 'f16' as KvType,
          models_dir: '~/Library/Application Support/dev.yoel3imari.llm-advisor/models',
          run_in_background: true,
          auto_update_catalog: true,
        })),
        listLibraryModels().catch(() => []),
        getHardwareProfile().catch(() => null),
      ]);
      setSettings(s);
      setRecords(recs);
      setProfile(p);
    } catch (err) {
      console.error('Failed to load settings data', err);
    }
  };

  const handleManualSyncCatalog = async () => {
    try {
      setSyncingCatalog(true);
      const res = await syncCatalog();
      if (res.status === 'Updated') {
        setActionNotice({
          type: 'success',
          text: `Model catalog updated! ${res.details.count} open-source models available.`,
        });
      } else {
        setActionNotice({
          type: 'info',
          text: 'Catalog is already up to date with the latest models.',
        });
      }
    } catch (err: unknown) {
      setActionNotice({
        type: 'info',
        text: `Catalog sync failed: ${String(err)}`,
      });
    } finally {
      setSyncingCatalog(false);
    }
  };

  const handleCheckAppUpdate = async () => {
    try {
      setCheckingAppUpdate(true);
      setAppUpdateNotice(null);
      const info = await checkAppUpdate();
      setAppUpdateInfo(info);
      if (info.update_available) {
        setAppUpdateNotice({
          type: 'success',
          text: `Update v${info.latest_version} is available!`,
        });
      } else {
        setAppUpdateNotice({
          type: 'info',
          text: `LLM Advisor is up to date (v${info.current_version}).`,
        });
      }
    } catch (err: unknown) {
      setAppUpdateNotice({
        type: 'error',
        text: `Update check failed: ${String(err)}`,
      });
    } finally {
      setCheckingAppUpdate(false);
    }
  };

  const handleInstallAppUpdate = async () => {
    try {
      setInstallingAppUpdate(true);
      const success = await installAppUpdate();
      if (success) {
        setAppUpdateNotice({
          type: 'success',
          text: 'Update installed! Restarting application to apply changes...',
        });
      }
    } catch (err: unknown) {
      setAppUpdateNotice({
        type: 'error',
        text: `Update installation failed: ${String(err)}`,
      });
    } finally {
      setInstallingAppUpdate(false);
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
      setActionNotice({
        text: 'Preferences saved successfully.',
        type: 'success',
      });
      setTimeout(() => {
        setSaved(false);
        setActionNotice(null);
      }, 3000);
      onSettingsChanged?.();
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyEndpoint = () => {
    const url = `http://127.0.0.1:${settings.gateway_port}/v1`;
    navigator.clipboard.writeText(url);
    setCopiedPort(true);
    setTimeout(() => setCopiedPort(false), 2000);
  };

  const handleCopyDir = () => {
    navigator.clipboard.writeText(settings.models_dir);
    setCopiedDir(true);
    setTimeout(() => setCopiedDir(false), 2000);
  };

  const handleReconcile = async () => {
    try {
      setReconciling(true);
      const res = await reconcileLibrary();
      if (res.orphan_files && res.orphan_files.length > 0) {
        const pruned = await pruneOrphans(res.orphan_files);
        setActionNotice({
          text: `Cleaned up ${res.orphan_files.length} orphan/incomplete model files (${pruned} bytes reclaimed).`,
          type: 'success',
        });
      } else {
        setActionNotice({
          text: `Library is healthy. Verified ${res.valid_records.length} model records with 0 orphan files.`,
          type: 'info',
        });
      }
      await loadData();
      onSettingsChanged?.();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error('Failed to reconcile library', err);
    } finally {
      setReconciling(false);
    }
  };

  const handlePurgeAll = async () => {
    try {
      await purgeAllModels();
      setActionNotice({
        text: 'Successfully purged all downloaded model weights.',
        type: 'success',
      });
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
      setActionNotice({
        text: 'Factory reset complete. Application returned to default state.',
        type: 'success',
      });
      await loadData();
      onSettingsChanged?.();
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error('Failed to factory reset', err);
    }
  };

  const handleAutomatedUninstallComplete = async () => {
    await loadData();
    onSettingsChanged?.();
    setActionNotice({
      text: 'Automated deep clean completed. All weights, caches, and configs wiped.',
      type: 'success',
    });
    setTimeout(() => setActionNotice(null), 5000);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 ">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Application Settings</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Configure inference defaults, OpenAI gateway (:13370), background execution, and automated uninstallation
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-950/50 transition-all disabled:opacity-50"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Preferences</span>
            </>
          )}
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in-0 duration-200 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : 'bg-indigo-950/80 border-indigo-800 text-indigo-300'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          )}
          <span className="font-medium">{actionNotice.text}</span>
        </div>
      )}

      <div className="space-y-6 text-sm">
        {/* Section 1: Background Execution & System Tray */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-indigo-400 font-semibold">
              <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center">
                <Minimize2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">Background Execution & System Tray</h3>
                <p className="text-[11px] text-zinc-400 font-normal">
                  Keep active model servers available for external developer tools
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2.5 py-1 rounded-md">
              Tray Supervised
            </span>
          </div>

          <div className="pt-1 border-t border-zinc-800/60">
            <CheckboxField
              checked={settings.run_in_background ?? true}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, run_in_background: !!checked })
              }
              label="Keep inference server and gateway running when main window is closed"
              description="When enabled, closing the window hides the application to the system tray so Cursor, Continue, Cline, Aider, and local scripts continue receiving OpenAI completions seamlessly."
            />
          </div>
        </div>

        {/* Section 2: Inference & Serving Defaults */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-violet-400 font-semibold">
              <div className="w-8 h-8 rounded-lg bg-violet-950/80 border border-violet-800/80 flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">Inference & Serving Defaults</h3>
                <p className="text-[11px] text-zinc-400 font-normal">
                  Default parameters applied when launching models from dashboard or library
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono bg-violet-950 text-violet-300 border border-violet-800/60 px-2.5 py-1 rounded-md">
              llama-server
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-zinc-800/60">
            {/* Default Context Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-violet-400" />
                <span>Default Context Window</span>
              </label>
              <Select
                value={String(settings.default_context_size || 4096)}
                onValueChange={(val) =>
                  setSettings({ ...settings, default_context_size: parseInt(val) || 4096 })
                }
              >
                <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 h-9">
                  <SelectValue placeholder="Select context size" />
                </SelectTrigger>
                <SelectContent>
                  {CONTEXT_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={String(preset.value)}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-zinc-500">
                Determines default KV cache buffer allocated at model startup.
              </p>
            </div>

            {/* Default KV Cache Quantization */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-violet-400" />
                <span>Default KV Cache Quantization</span>
              </label>
              <Select
                value={settings.default_kv_type || 'f16'}
                onValueChange={(val) =>
                  setSettings({ ...settings, default_kv_type: val as KvType })
                }
              >
                <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 h-9">
                  <SelectValue placeholder="Select KV type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="f16">FP16 - Full 16-bit Precision (Default)</SelectItem>
                  <SelectItem value="q8_0">Q8_0 - 8-bit Quantized (~50% VRAM Savings)</SelectItem>
                  <SelectItem value="q4_0">Q4_0 - 4-bit Quantized (~75% VRAM Savings)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-zinc-500">
                Quantized KV types allow serving significantly larger contexts on constrained hardware.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Hugging Face Access Token */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-indigo-400 font-semibold">
              <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">Hugging Face Access Token</h3>
                <p className="text-[11px] text-zinc-400 font-normal">
                  Authenticate for gated repositories such as Meta Llama 3.1 & 3.3
                </p>
              </div>
            </div>
            {settings.hf_token ? (
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-1 rounded-md flex items-center gap-1">
                <Check className="w-3 h-3" /> Token Set
              </span>
            ) : (
              <span className="text-[11px] font-medium text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-md">
                Optional
              </span>
            )}
          </div>

          <div className="space-y-2 pt-1 border-t border-zinc-800/60">
            <div className="relative flex items-center">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="hf_..."
                value={settings.hf_token}
                onChange={(e) => setSettings({ ...settings, hf_token: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3.5 pr-10 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 text-zinc-400 hover:text-zinc-200 transition-colors"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Token is stored securely in local OS application storage and never shared.</span>
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <span>Get Token</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Section 4: Gateway & Network Configuration */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-cyan-400 font-semibold">
              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center">
                <Network className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">OpenAI-Compatible Gateway Network</h3>
                <p className="text-[11px] text-zinc-400 font-normal">
                  Local zero-buffering reverse proxy serving OpenAI completions
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-2.5 py-1 rounded-md">
              ADR-3a Strict Port
            </span>
          </div>

          <div className="space-y-3 pt-1 border-t border-zinc-800/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-zinc-200">Gateway Port</div>
                <p className="text-[11px] text-zinc-400">
                  Standard OpenAI tools hardcode port 13370. Strict loopback binding prevents collisions.
                </p>
              </div>
              <input
                type="number"
                value={settings.gateway_port}
                onChange={(e) =>
                  setSettings({ ...settings, gateway_port: parseInt(e.target.value) || 13370 })
                }
                className="w-28 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 font-mono text-xs text-zinc-100 text-right focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Quick Endpoint Copy Box */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  OpenAI Base URL Endpoint
                </span>
                <div className="font-mono text-xs text-cyan-300">
                  http://127.0.0.1:{settings.gateway_port}/v1
                </div>
              </div>
              <button
                onClick={handleCopyEndpoint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 transition-colors"
              >
                {copiedPort ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Section 5: Model Catalog Synchronization */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sky-400 font-semibold">
              <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-800/80 flex items-center justify-center">
                <Globe className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">Model Catalog Synchronization</h3>
                <p className="text-[11px] text-zinc-400 font-normal">
                  Automatically discover and verify newly released open-source models on startup
                </p>
              </div>
            </div>
            <button
              onClick={handleManualSyncCatalog}
              disabled={syncingCatalog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingCatalog ? 'animate-spin text-sky-400' : ''}`} />
              <span>{syncingCatalog ? 'Checking...' : 'Check for Updates Now'}</span>
            </button>
          </div>

          <div className="space-y-4 pt-1 border-t border-zinc-800/60">
            {/* Auto-update Toggle */}
            <div className="pt-1">
              <CheckboxField
                id="auto-update-catalog-checkbox"
                checked={settings.auto_update_catalog ?? true}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, auto_update_catalog: Boolean(checked) })
                }
                label="Check for new models automatically on application startup"
                description="Performs a lightweight, non-blocking check on application startup so newly verified models appear in the catalog seamlessly."
              />
            </div>
          </div>
        </div>

        {/* Section 6: Application Updates & Version Lifecycle */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-violet-400 font-semibold">
              <div className="w-8 h-8 rounded-lg bg-violet-950/80 border border-violet-800/80 flex items-center justify-center">
                <ArrowUpCircle className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">Application Updates & Version</h3>
                <p className="text-[11px] text-zinc-400 font-normal">
                  Manage native application releases, sidecar updates, and engine improvements
                </p>
              </div>
            </div>
            <button
              onClick={handleCheckAppUpdate}
              disabled={checkingAppUpdate || installingAppUpdate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingAppUpdate ? 'animate-spin text-violet-400' : ''}`} />
              <span>{checkingAppUpdate ? 'Checking...' : 'Check for App Updates'}</span>
            </button>
          </div>

          <div className="space-y-3 pt-1 border-t border-zinc-800/60">
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-zinc-400">Current Installed Version:</span>
              <span className="font-mono text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded text-[11px] border border-zinc-700">
                v0.1.0
              </span>
            </div>

            {appUpdateNotice && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  appUpdateNotice.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
                    : appUpdateNotice.type === 'error'
                    ? 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
                    : 'bg-zinc-800/80 border border-zinc-700/80 text-zinc-300'
                }`}
              >
                <Info className="w-4 h-4 shrink-0" />
                <span>{appUpdateNotice.text}</span>
              </div>
            )}

            {appUpdateInfo?.update_available && (
              <div className="bg-violet-950/30 border border-violet-800/50 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-violet-200">
                      Version {appUpdateInfo.latest_version} Ready
                    </div>
                    {appUpdateInfo.pub_date && (
                      <div className="text-[10px] text-zinc-400">
                        Released: {new Date(appUpdateInfo.pub_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleInstallAppUpdate}
                    disabled={installingAppUpdate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                  >
                    <ArrowDownToLine className={`w-3.5 h-3.5 ${installingAppUpdate ? 'animate-bounce' : ''}`} />
                    <span>{installingAppUpdate ? 'Installing & Relaunching...' : 'Update & Restart'}</span>
                  </button>
                </div>
                {appUpdateInfo.release_notes && (
                  <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-2.5 text-[11px] text-zinc-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {appUpdateInfo.release_notes}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 7: Model Storage Location & Reclaim */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-emerald-400 font-semibold">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center">
                <Folder className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">Models Storage Directory & Reclaim</h3>
                <p className="text-[11px] text-zinc-400 font-normal">
                  Location of downloaded GGUF weights, disk metrics, and orphan pruning
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2.5 py-1 rounded-md">
              {formatGb(totalBytes)} GB Used
            </span>
          </div>

          <div className="space-y-4 pt-1 border-t border-zinc-800/60">
            {/* Storage Path Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Models Storage Path</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings.models_dir}
                  onChange={(e) => setSettings({ ...settings, models_dir: e.target.value })}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleCopyDir}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors shrink-0"
                  title="Copy directory path"
                >
                  {copiedDir ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Storage Utilization Card */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Library Size</span>
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {formatGb(totalBytes)} GB
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Installed Models</span>
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {records.length} {records.length === 1 ? 'model' : 'models'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Drive Free Space</span>
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {profile ? formatGb(profile.disk_free_bytes) : '240.00'} GB
                </div>
              </div>
            </div>

            {/* Storage Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleReconcile}
                disabled={reconciling}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${reconciling ? 'animate-spin' : ''}`} />
                <span>Reconcile & Prune Orphans</span>
              </button>

              <button
                onClick={() => setPurgeOpen(true)}
                disabled={records.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Purge All Model Weights ({records.length})</span>
              </button>

              <button
                onClick={() => setResetOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                <span>Factory Reset State</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 6: Automated Deep Clean & Uninstaller (Replaces manual guide!) */}
        <div className="bg-gradient-to-br from-red-950/30 via-zinc-900/60 to-zinc-900 border border-red-900/40 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center shrink-0 text-red-400 shadow-inner">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-white text-base font-bold tracking-tight">
                    Automated Application Uninstaller & Cleaner
                  </h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-red-900/70 text-red-200 px-2 py-0.5 rounded-full border border-red-700/60">
                    Zero-Residue
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                  Standard OS uninstallers leave multi-gigabyte GGUF models, cache files, and API keys intact on disk. Click the button below to run an automated, one-click deep cleanup that safely purges all data before deleting the application.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUninstallOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-950/60 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Automated Cleaner</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog: Purge Models */}
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

      {/* Confirmation Dialog: Factory Reset */}
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

      {/* Automated Uninstaller Modal */}
      <UninstallDialog
        open={uninstallOpen}
        onOpenChange={setUninstallOpen}
        totalBytes={totalBytes}
        modelCount={records.length}
        onCleanupComplete={handleAutomatedUninstallComplete}
      />
    </div>
  );
}
