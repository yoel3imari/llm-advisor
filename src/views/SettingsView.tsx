import { useState, useEffect } from 'react';
import { KeyRound, Network, Folder, Save, Check } from 'lucide-react';
import type { AppSettings } from '../types/domain';
import { getSettings, saveSettings } from '../ipc/commands';

export function SettingsView() {
  const [settings, setSettings] = useState<AppSettings>({
    hf_token: '',
    gateway_port: 13370,
    default_context_size: 4096,
    default_kv_type: 'f16',
    models_dir: '~/Library/Application Support/dev.portfolio.local-llm-advisor/models',
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Application Settings</h2>
        <p className="text-sm text-zinc-400 mt-0.5">
          Configure API credentials, network ports, and storage locations
        </p>
      </div>

      <div className="space-y-5 text-sm">
        {/* HuggingFace Token */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold">
            <KeyRound className="w-4 h-4" />
            <h3 className="text-white">Hugging Face Access Token</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Required for downloading gated model families (such as Meta Llama 3.1). Stored securely in OS keychain.
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
              onChange={(e) => setSettings({ ...settings, gateway_port: parseInt(e.target.value) || 13370 })}
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
      </div>
    </div>
  );
}
