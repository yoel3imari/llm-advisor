import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Cpu,
  HardDrive,
  RefreshCw,
  Layers,
  AlertTriangle,
  Search,
  Sliders,
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
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-corporate">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Hardware Profiling Error</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
    <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-6 custom-scrollbar relative z-10">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <span className="brand-gradient-text">Dashboard & Recommendations</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800 shadow-sm font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                {profile.accelerator_backend || 'Live Fit'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              Host silicon telemetry · Mathematical KV fit verification · Ephemeral port binding
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-sm hover:-translate-y-0.5 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Refresh Hardware</span>
        </button>
      </div>

      {/* 1. Asymmetric Bento Telemetry Deck with Dimensional Depth */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 perspective-2000">
        {/* Hero Card: Unified Memory / VRAM Radar (Span 2 cols on lg) */}
        <div className="lg:col-span-2 corporate-card p-5 space-y-3.5 hover:shadow-corporate-hover hover:-translate-y-1 transition-all duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 font-mono">
                {profile.has_unified_memory ? 'Unified Memory Architecture (UMA)' : 'Host System Memory'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 font-bold">
                {workingSetPct}% Usable Working Set
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="font-mono tabular-nums">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{workingSetGb}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">GB Usable Headroom</span>
            </div>
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              Total RAM: <span className="text-slate-800 dark:text-slate-200 font-bold">{hostRamGb} GB</span>
            </div>
          </div>

          {/* Precision Multi-Segment Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/80 dark:border-slate-700 p-[1px] flex shadow-inner">
              <div
                style={{ width: `${workingSetPct}%` }}
                className="h-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 rounded-full transition-all duration-500 shadow-sm"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              <span>0 GB</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">Safe Inference Ceiling: {workingSetGb} GB</span>
              <span>{hostRamGb} GB Total</span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80">
            <span>
              {profile.has_unified_memory
                ? 'Zero-copy high-bandwidth unified bus shared with Metal GPU'
                : 'Host system RAM available for CPU inference & partial offload'}
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[10px] uppercase font-bold">Zero-OOM Cap</span>
          </div>
        </div>

        {/* Card 2: Silicon Engine (1 Col) */}
        <div className="corporate-card p-4 space-y-2.5 flex flex-col justify-between hover:shadow-corporate-hover hover:-translate-y-1 transition-all duration-200">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400 flex items-center justify-center shadow-sm">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 font-mono">Silicon Engine</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase font-semibold">{profile.arch}</span>
            </div>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2 truncate" title={profile.cpu_name}>
              {profile.cpu_name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
              {profile.cpu_physical_cores} Physical · {profile.cpu_logical_cores} Threads
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
              {gpuVramGb > 0 ? `VRAM (${gpuVramGb} GB):` : 'ACCELERATOR:'}
            </span>
            <span className="font-mono text-violet-600 dark:text-violet-300 font-bold truncate max-w-[120px]">
              {profile.gpu_name || profile.accelerator_backend || (profile.has_unified_memory ? 'Metal GPU' : 'CPU')}
            </span>
          </div>
        </div>

        {/* Card 3: High-Speed Storage (1 Col) */}
        <div className="corporate-card p-4 space-y-2.5 flex flex-col justify-between hover:shadow-corporate-hover hover:-translate-y-1 transition-all duration-200">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
                  <HardDrive className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 font-mono">NVMe Storage</h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">READY</span>
            </div>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2 font-mono tabular-nums">
              {diskFreeGb} GB <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Available</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1" title={profile.os_version}>
              {profile.os_version}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">GGUF WEIGHTS:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{libraryRecords.length} Saved</span>
          </div>
        </div>
      </div>

      {/* 2. Hardware Synthesizer Parameter Console & Filters */}
      <div className="corporate-panel p-4 space-y-4 shadow-corporate">
        {/* Search & Filter Top Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search model, family (Llama, Qwen, DeepSeek), or quant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Family Filter Dropdown */}
            <DropdownMenu onOpenChange={(open) => { if (!open) setFamilySearch(''); }}>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[125px]">
                  <span className="truncate">
                    {familyFilter === 'all'
                      ? 'All Families'
                      : familyFilter.charAt(0).toUpperCase() + familyFilter.slice(1)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[185px] max-h-72 shadow-corporate">
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
                <button className="flex h-8 items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[125px]">
                  <span className="truncate">
                    {verdictFilter === 'all'
                      ? 'All Verdicts'
                      : verdictFilter === 'fits'
                      ? 'Fits Only'
                      : verdictFilter === 'tight'
                      ? 'Tight Fit'
                      : 'No Fit'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[140px] max-h-60 shadow-corporate">
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
                <button className="flex h-8 items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[135px]">
                  <span className="truncate">
                    {statusFilter === 'all'
                      ? 'All Statuses'
                      : statusFilter === 'downloaded'
                      ? 'Downloaded (Ready)'
                      : 'Available to Download'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[175px] max-h-60 shadow-corporate">
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
              className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 hover:-translate-y-0.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  syncingCatalog ? 'animate-spin text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                }`}
              />
              <span className="hidden sm:inline font-mono">
                {syncingCatalog ? 'Syncing...' : 'Sync Catalog'}
              </span>
              <span className="sm:hidden font-mono">
                {syncingCatalog ? 'Syncing' : 'Sync'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Serving & Context Configuration Console */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-1">
          {/* Context Stepper Rack */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">
              <Sliders className="w-3.5 h-3.5" />
              <span>CONTEXT:</span>
            </div>
            <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold tabular-nums w-12 text-sm">{config.context_size}</span>
            <Slider
              min={512}
              max={32768}
              step={512}
              value={[config.context_size]}
              onValueChange={(val) => setConfig({ ...config, context_size: val[0] })}
              className="w-28 cursor-pointer"
            />
            {/* Quick Context Presets */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              {[2048, 4096, 8192, 16384, 32768].map((size) => (
                <button
                  key={size}
                  onClick={() => setConfig({ ...config, context_size: size })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono tabular-nums transition-all ${
                    config.context_size === size
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700'
                  }`}
                >
                  {size >= 1024 ? `${size / 1024}k` : size}
                </button>
              ))}
            </div>
          </div>

          {/* KV Cache Quant & Parallel Slots Rockers */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase px-1">KV:</span>
              <button
                onClick={() => setConfig({ ...config, kv_type: 'f16' })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  config.kv_type === 'f16'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700'
                }`}
                title="F16: Baseline memory footprint"
              >
                F16
              </button>
              <button
                onClick={() => setConfig({ ...config, kv_type: 'q8_0' })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  config.kv_type === 'q8_0'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700'
                }`}
                title="Q8_0: -50% KV cache VRAM requirement"
              >
                Q8_0
              </button>
              <button
                onClick={() => setConfig({ ...config, kv_type: 'q4_0' })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  config.kv_type === 'q4_0'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700'
                }`}
                title="Q4_0: -75% KV cache VRAM requirement"
              >
                Q4_0
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase px-1">Slots:</span>
              {[1, 2, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setConfig({ ...config, n_parallel: n })}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                    config.n_parallel === n
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700'
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
