import { useState } from 'react';
import { Cpu, HardDrive, RefreshCw, Layers, AlertTriangle } from 'lucide-react';
import type { HardwareProfile } from '../types/domain';
import { refreshHardwareProfile } from '../ipc/commands';

interface Props {
  profile: HardwareProfile | null;
  onProfileUpdated: (profile: HardwareProfile) => void;
  error?: string | null;
}

export function DashboardView({ profile, onProfileUpdated, error }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const updated = await refreshHardwareProfile();
      onProfileUpdated(updated);
    } catch (err) {
      console.error('Failed to refresh hardware profile', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (error || (profile && (profile.arch === 'aarch64' || profile.arch === 'arm64'))) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Platform Not Supported in v1</h2>
        <p className="text-sm text-zinc-400 max-w-md">
          {error || 'This build of Local LLM Advisor is optimized specifically for macOS Apple Intel (x86_64) systems. Apple Silicon (ARM64) is scheduled for v2.'}
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const gb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(1);
  const hostRamGb = parseFloat(gb(profile.total_ram_bytes));
  const workingSetGb = parseFloat(gb(profile.metal_working_set_bytes));
  const workingSetPct = Math.round((profile.metal_working_set_bytes / profile.total_ram_bytes) * 100);

  const gpuVramGb = profile.gpu_vram_bytes ? parseFloat(gb(profile.gpu_vram_bytes)) : 0;
  const diskFreeGb = parseFloat(gb(profile.disk_free_bytes));

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Hardware Specifications</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Inspected hardware capabilities and working-set memory limits
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          Refresh Specs
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CPU Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3 text-indigo-400">
            <Cpu className="w-5 h-5" />
            <h3 className="font-semibold text-white">Processor & Architecture</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-zinc-400">CPU Model</div>
              <div className="font-medium text-zinc-100 mt-0.5">{profile.cpu_name}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-xs">
              <div>
                <span className="text-zinc-400">Architecture</span>
                <p className="font-semibold text-zinc-200 mt-0.5">{profile.arch}</p>
              </div>
              <div>
                <span className="text-zinc-400">Physical Cores</span>
                <p className="font-semibold text-zinc-200 mt-0.5">{profile.cpu_physical_cores}</p>
              </div>
              <div>
                <span className="text-zinc-400">Logical Threads</span>
                <p className="font-semibold text-zinc-200 mt-0.5">{profile.cpu_logical_cores}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Host Memory Budget Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-cyan-400">
              <Layers className="w-5 h-5" />
              <h3 className="font-semibold text-white">Host RAM Budget</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              {workingSetGb} GB Usable ({workingSetPct}%)
            </span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Working-Set Ceiling: <strong>{workingSetGb} GB</strong></span>
              <span>Total Installed: <strong>{hostRamGb} GB</strong></span>
            </div>
            <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
              <div
                style={{ width: `${workingSetPct}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full"
              />
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Models fitting within {workingSetGb} GB can execute locally without kernel paging or out-of-memory lockups.
            </p>
          </div>
        </div>

        {/* Dedicated GPU & VRAM Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3 text-purple-400">
            <Cpu className="w-5 h-5" />
            <h3 className="font-semibold text-white">Graphics & Acceleration</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-zinc-400">GPU Identity</div>
              <div className="font-medium text-zinc-100 mt-0.5">{profile.gpu_name || 'Integrated Graphics / CPU Engine'}</div>
            </div>
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Dedicated VRAM:</span>
                <strong className="text-zinc-200">{gpuVramGb > 0 ? `${gpuVramGb} GB Dedicated` : 'Shared System RAM'}</strong>
              </div>
              {gpuVramGb > 0 && (
                <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div style={{ width: '100%' }} className="h-full bg-purple-500 rounded-full" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Storage & OS Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3 text-emerald-400">
            <HardDrive className="w-5 h-5" />
            <h3 className="font-semibold text-white">Disk Storage & Environment</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-zinc-400">Operating System</div>
              <div className="font-medium text-zinc-100 mt-0.5">{profile.os_version}</div>
            </div>
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Free Storage Space:</span>
                <strong className="text-emerald-400">{diskFreeGb} GB Available</strong>
              </div>
              <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div style={{ width: '65%' }} className="h-full bg-emerald-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
