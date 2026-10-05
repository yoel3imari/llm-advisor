import * as React from 'react';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { getCatalog, listLibraryModels, startServer } from '../../ipc/commands';
import type { CatalogEntry, ModelRecord } from '../../types/domain';
import { cn } from '../../lib/utils';

export function getModelFamilyName(
  entryId: string,
  catalogMap: Record<string, CatalogEntry>
): string {
  if (catalogMap[entryId]?.family) {
    return catalogMap[entryId].family;
  }
  const match = entryId.match(/^([a-zA-Z0-9._]+(?:-[a-zA-Z0-9._]+)?)(?:-\d+(?:\.\d+)?b)?/i);
  if (match && match[1]) {
    return match[1];
  }
  return entryId;
}

export function ModelSelector({
  selectedModelId,
  runningModelId = null,
  isStreaming = false,
  contextSize = 4096,
  onSelect,
  onServerStarted,
  triggerClassName,
  models: propModels,
}: {
  selectedModelId: string | null;
  runningModelId?: string | null;
  isStreaming?: boolean;
  contextSize?: number;
  onSelect: (modelId: string) => void;
  onServerStarted?: () => void;
  triggerClassName?: string;
  models?: ModelRecord[];
}) {
  const [internalModels, setInternalModels] = React.useState<ModelRecord[]>([]);
  const [catalogMap, setCatalogMap] = React.useState<Record<string, CatalogEntry>>({});
  const [warming, setWarming] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const fetchModels = React.useCallback(async () => {
    try {
      const [records, catalogEntries] = await Promise.all([
        listLibraryModels(),
        getCatalog().catch(() => [] as CatalogEntry[]),
      ]);
      setInternalModels(records);
      const map: Record<string, CatalogEntry> = {};
      for (const entry of catalogEntries) {
        map[entry.id] = entry;
      }
      setCatalogMap(map);
    } catch (e) {
      setLoadError(String(e));
    }
  }, []);

  React.useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const models = propModels !== undefined ? propModels : internalModels;

  const busy = warming || isStreaming;

  const handleChange = async (modelId: string) => {
    if (busy) return;
    if (modelId === runningModelId) {
      onSelect(modelId);
      return;
    }
    setWarming(true);
    try {
      await startServer(modelId, {
        context_size: contextSize,
        n_parallel: 1,
        kv_type: 'q8_0',
        n_gpu_layers: null,
      });
      onSelect(modelId);
      onServerStarted?.();
    } catch (e) {
      setLoadError(`Failed to start model: ${String(e)}`);
    } finally {
      setWarming(false);
    }
  };

  if (models.length === 0 && !loadError) {
    return (
      <p className="text-xs text-zinc-500 font-mono">
        No downloaded models — download one from the Library first.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedModelId ?? ''}
        onValueChange={handleChange}
        onOpenChange={(open) => {
          if (open) fetchModels();
        }}
        disabled={busy}
      >
        <SelectTrigger
          aria-label="Select model"
          className={cn(
            'h-8 rounded-xl px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-sm hover:border-indigo-300 dark:hover:border-slate-600 transition-colors min-w-[120px] max-w-[200px] truncate',
            triggerClassName
          )}
        >
          <SelectValue placeholder="Select a model">
            <span
              className="block min-w-0 max-w-full truncate font-mono"
              title={selectedModelId ?? undefined}
            >
              {selectedModelId}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => {
            const familyName = getModelFamilyName(m.entry_id, catalogMap);
            return (
              <SelectItem key={m.entry_id} value={m.entry_id} title={m.entry_id}>
                <span
                  className="block max-w-[240px] truncate font-mono font-medium"
                  title={m.entry_id}
                >
                  {m.entry_id}
                </span>
                {familyName !== m.entry_id && (
                  <span
                    className="block max-w-[240px] truncate text-[10px] text-slate-500 dark:text-slate-400"
                    title={familyName}
                  >
                    {familyName}
                  </span>
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {warming && (
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Warming up…
        </span>
      )}
      {loadError && (
        <span className="text-xs text-red-400" role="alert">
          {loadError}
        </span>
      )}
    </div>
  );
}
