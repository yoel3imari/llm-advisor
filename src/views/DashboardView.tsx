import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Cpu,
  HardDrive,
  RefreshCw,
  Layers,
  AlertTriangle,
  Search,
  Sliders,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import type { FitResult, HardwareProfile, ModelRecord, ServeConfig, DownloadTask } from '../types/domain';
import {
  refreshHardwareProfile,
  recommendModels,
  startDownload,
  deleteLibraryModel,
  syncCatalog,
} from '../ipc/commands';
import { ModelsTable } from '../components/dashboard/ModelsTable';
import { useToast } from '../components/ui/Toast';
import { listen } from '@tauri-apps/api/event';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSearchInput,
  DropdownMenuEmpty,
} from '../components/ui/DropdownMenu';
import { Input } from '../components/ui/Input';
import { Slider } from '../components/ui/Slider';
import appLogo from '../public/logo.png';

function isDeepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface Props {
  profile: HardwareProfile | null;
  libraryRecords: ModelRecord[];
  activeDownloads?: DownloadTask[];
  onProfileUpdated: (profile: HardwareProfile) => void;
  onModelDownloaded: () => void;
  onNavigateToServer: (modelId: string) => void;
  error?: string | null;
}

export function DashboardView({
  profile,
  libraryRecords,
  activeDownloads = [],
  onProfileUpdated,
  onModelDownloaded,
  onNavigateToServer,
  error,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);

  // Fit configuration state (drives live recommendations)
  const [config, setConfig] = useState<ServeConfig>({
    context_size: 4096,
    n_parallel: 1,
    kv_type: 'f16',
    n_gpu_layers: null,
  });

  const [results, setResults] = useState<FitResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [syncingCatalog, setSyncingCatalog] = useState(false);

  const { showToast } = useToast();

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [familySearch, setFamilySearch] = useState('');

  // Fetch recommendations whenever serve config changes
  useEffect(() => {
    let active = true;
    const fetchRecommendations = async () => {
      setLoadingResults(true);
      try {
        const data = await recommendModels(config);
        if (active) {
          setResults((prev) => (isDeepEqual(prev, data) ? prev : data));
        }
      } catch (err) {
        console.error('Failed to get recommendations', err);
      } finally {
        if (active) setLoadingResults(false);
      }
    };

    fetchRecommendations();
    return () => {
      active = false;
    };
  }, [config]);

  // Listen for background catalog update events on startup or manual sync
  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        unlisten = await listen<{ count: number; etag?: string }>('catalog:updated', async (event) => {
          showToast({
            type: 'info',
            title: 'Catalog Synced',
            description: `Refreshed recommendations with ${event.payload.count} open-source models available.`,
          });
          const data = await recommendModels(config);
          setResults(data);
        });
      } catch (err) {
        console.error('Failed to register catalog:updated listener', err);
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, [config, showToast]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const updated = await refreshHardwareProfile();
      onProfileUpdated(updated);
      const data = await recommendModels(config);
      setResults(data);
    } catch (err) {
      console.error('Failed to refresh hardware profile', err);
    } finally {
      setRefreshing(false);
    }
  }, [config, onProfileUpdated]);

  const handleSyncCatalog = useCallback(async () => {
    try {
      setSyncingCatalog(true);
      const res = await syncCatalog();
      if (res.status === 'Updated') {
        showToast({
          type: 'success',
          title: 'Catalog Updated',
          description: `Discovered latest open-source models (${res.details.count} models available).`,
        });
        const data = await recommendModels(config);
        setResults(data);
      } else {
        showToast({
          type: 'info',
          title: 'Catalog Up to Date',
          description: 'No new models found. You have the latest catalog.',
        });
      }
    } catch (err) {
      console.error('Failed to sync catalog', err);
      showToast({
        type: 'error',
        title: 'Catalog Sync Failed',
        description: String(err),
      });
    } finally {
      setSyncingCatalog(false);
    }
  }, [config, showToast]);

  const handleDownload = useCallback(async (entryId: string) => {
    try {
      setDownloadingId(entryId);
      await startDownload(entryId);
      onModelDownloaded();
    } catch (err) {
      console.error('Failed to start download', err);
    } finally {
      setDownloadingId(null);
    }
  }, [onModelDownloaded]);

  const handleDeleteFromLibrary = useCallback(async (entryId: string) => {
    try {
      await deleteLibraryModel(entryId);
      onModelDownloaded();
    } catch (err) {
      console.error('Failed to delete model', err);
    }
  }, [onModelDownloaded]);

  // Available families in current results for dropdown
  const uniqueFamilies = useMemo(
    () => Array.from(new Set(results.map((r) => r.entry.family))).sort(),
    [results]
  );

  const filteredFamilies = useMemo(() => {
    const q = familySearch.trim().toLowerCase();
    if (!q) return uniqueFamilies;
    return uniqueFamilies.filter((fam) => fam.toLowerCase().includes(q));
  }, [uniqueFamilies, familySearch]);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Hardware Profiling Error</h2>
        <p className="text-sm text-zinc-400 max-w-md">{error}</p>
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
  const hostBudget = Math.min(profile.metal_working_set_bytes, profile.total_ram_bytes);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              Dashboard & Recommendations
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                {profile.accelerator_backend || 'Live Fit'}
              </span>
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Inspect host machine limits, configure inference parameters, and explore mathematically verified models
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-800 transition-colors disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          Refresh Specs
        </button>
      </div>

      {/* 1. Machine Specs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Processor Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400">
            <Cpu className="w-4 h-4" />
            <h3 className="font-semibold text-xs text-white uppercase tracking-wider">Processor</h3>
          </div>
          <div className="font-semibold text-sm text-zinc-100 truncate" title={profile.cpu_name}>
            {profile.cpu_name}
          </div>
          <div className="text-xs text-zinc-400 font-mono">
            {profile.cpu_physical_cores}C / {profile.cpu_logical_cores}T ({profile.arch})
          </div>
        </div>

        {/* RAM Budget Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-cyan-400">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">
                {profile.has_unified_memory ? 'Unified Memory' : 'Host RAM Budget'}
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-cyan-300">
              {workingSetPct}% Usable
            </span>
          </div>
          <div className="font-semibold text-sm text-zinc-100 font-mono">
            {workingSetGb} GB <span className="text-xs font-normal text-zinc-400">/ {hostRamGb} GB Total</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
            <div
              style={{ width: `${workingSetPct}%` }}
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full"
            />
          </div>
        </div>

        {/* Dedicated / Unified GPU Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-purple-400">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">
                {profile.has_unified_memory ? 'UMA Accelerator' : 'GPU & VRAM'}
              </h3>
            </div>
            {gpuVramGb > 0 ? (
              <span className="text-[10px] font-mono font-bold text-purple-300">
                {gpuVramGb} GB VRAM
              </span>
            ) : profile.has_unified_memory ? (
              <span className="text-[10px] font-mono font-bold text-purple-300">
                UMA Metal
              </span>
            ) : null}
          </div>
          <div className="font-semibold text-sm text-zinc-100 truncate" title={profile.gpu_name || profile.accelerator_backend || 'CPU Inference Engine'}>
            {profile.gpu_name || profile.accelerator_backend || 'CPU Engine / Integrated'}
          </div>
          <div className="text-xs text-zinc-400">
            {profile.has_unified_memory
              ? 'Unified System RAM'
              : gpuVramGb > 0
              ? `${gpuVramGb} GB Dedicated VRAM`
              : profile.accelerator_backend || 'Shared System RAM'}
          </div>
        </div>

        {/* Storage Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <HardDrive className="w-4 h-4" />
            <h3 className="font-semibold text-xs text-white uppercase tracking-wider">Free Storage</h3>
          </div>
          <div className="font-semibold text-sm text-zinc-100 font-mono">
            {diskFreeGb} GB Available
          </div>
          <div className="text-xs text-zinc-400 truncate" title={profile.os_version}>
            {profile.os_version}
          </div>
        </div>
      </div>

      {/* 2. Model Filters & Fit Configuration Controls */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-3.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by model name, family, or quant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs"
            />
          </div>

          {/* Custom DropdownMenu Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Family Filter Dropdown */}
            <DropdownMenu onOpenChange={(open) => { if (!open) setFamilySearch(''); }}>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 shadow-sm hover:border-zinc-700 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[125px]">
                  <span className="truncate">
                    {familyFilter === 'all'
                      ? 'All Families'
                      : familyFilter.charAt(0).toUpperCase() + familyFilter.slice(1)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[185px] max-h-72">
                <DropdownMenuLabel>Filter Family ({uniqueFamilies.length})</DropdownMenuLabel>
                <DropdownMenuSearchInput
                  value={familySearch}
                  onChange={(e) => setFamilySearch(e.target.value)}
                  placeholder="Search families..."
                />
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={familyFilter} onValueChange={setFamilyFilter}>
                  {!familySearch && (
                    <DropdownMenuRadioItem value="all">All Families</DropdownMenuRadioItem>
                  )}
                  {filteredFamilies.map((fam) => (
                    <DropdownMenuRadioItem
                      key={fam}
                      value={fam.toLowerCase()}
                      className="capitalize"
                    >
                      {fam}
                    </DropdownMenuRadioItem>
                  ))}
                  {filteredFamilies.length === 0 && (
                    <DropdownMenuEmpty>No families match &quot;{familySearch}&quot;</DropdownMenuEmpty>
                  )}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Verdict Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 shadow-sm hover:border-zinc-700 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[125px]">
                  <span className="truncate">
                    {verdictFilter === 'all'
                      ? 'All Verdicts'
                      : verdictFilter === 'fits'
                      ? 'Fits Only'
                      : verdictFilter === 'tight'
                      ? 'Tight Fit'
                      : 'No Fit'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[140px] max-h-60">
                <DropdownMenuLabel>Filter Verdict</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={verdictFilter} onValueChange={setVerdictFilter}>
                  <DropdownMenuRadioItem value="all">All Verdicts</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="fits">Fits Only</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="tight">Tight Fit</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="nofit">No Fit</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 shadow-sm hover:border-zinc-700 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[135px]">
                  <span className="truncate">
                    {statusFilter === 'all'
                      ? 'All Statuses'
                      : statusFilter === 'downloaded'
                      ? 'Downloaded (Ready)'
                      : 'Available to Download'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[175px] max-h-60">
                <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                  <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="downloaded">
                    Downloaded (Ready)
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="available">
                    Available to Download
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sync Catalog Button */}
            <button
              onClick={handleSyncCatalog}
              disabled={syncingCatalog}
              title="Check remote catalog for newly released open-source models"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300 shadow-sm hover:border-zinc-700 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  syncingCatalog ? 'animate-spin text-indigo-400' : 'text-zinc-400'
                }`}
              />
              <span className="hidden sm:inline">
                {syncingCatalog ? 'Syncing...' : 'Sync Catalog'}
              </span>
              <span className="sm:hidden">
                {syncingCatalog ? 'Syncing' : 'Sync'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Serving & Context Configuration Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          {/* Context Slider & Presets */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
              <Sliders className="w-3.5 h-3.5" />
              <span>Context Size:</span>
            </div>
            <span className="font-mono text-indigo-300 font-bold w-12">{config.context_size}</span>
            <Slider
              min={512}
              max={32768}
              step={512}
              value={[config.context_size]}
              onValueChange={(val) => setConfig({ ...config, context_size: val[0] })}
              className="w-28 cursor-pointer"
            />
            {/* Quick Context Presets */}
            <div className="flex items-center gap-1">
              {[2048, 4096, 8192, 16384, 32768].map((size) => (
                <button
                  key={size}
                  onClick={() => setConfig({ ...config, context_size: size })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    config.context_size === size
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {size >= 1024 ? `${size / 1024}k` : size}
                </button>
              ))}
            </div>
          </div>

          {/* KV Cache Quant & Parallel Slots */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-zinc-300">KV Quant:</span>
              <button
                onClick={() => setConfig({ ...config, kv_type: 'f16' })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  config.kv_type === 'f16'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                F16
              </button>
              <button
                onClick={() => setConfig({ ...config, kv_type: 'q8_0' })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  config.kv_type === 'q8_0'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Q8_0
              </button>
              <button
                onClick={() => setConfig({ ...config, kv_type: 'q4_0' })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  config.kv_type === 'q4_0'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Q4_0
              </button>
            </div>

            <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-4">
              <span className="font-semibold text-zinc-300">Parallel Slots:</span>
              {[1, 2, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setConfig({ ...config, n_parallel: n })}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    config.n_parallel === n
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Models Table */}
      {loadingResults && results.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <ModelsTable
          results={results}
          hostBudget={hostBudget}
          libraryRecords={libraryRecords}
          activeDownloads={activeDownloads}
          downloadingId={downloadingId}
          onDownload={handleDownload}
          onNavigateToServer={onNavigateToServer}
          onDeleteFromLibrary={handleDeleteFromLibrary}
          searchQuery={searchQuery}
          familyFilter={familyFilter}
          verdictFilter={verdictFilter}
          statusFilter={statusFilter}
        />
      )}
    </div>
  );
}
