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
}: {
  selectedModelId: string | null;
  runningModelId?: string | null;
  isStreaming?: boolean;
  contextSize?: number;
  onSelect: (modelId: string) => void;
  onServerStarted?: () => void;
  triggerClassName?: string;
}) {
  const [models, setModels] = React.useState<ModelRecord[]>([]);
  const [catalogMap, setCatalogMap] = React.useState<Record<string, CatalogEntry>>({});
  const [warming, setWarming] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      listLibraryModels(),
      getCatalog().catch(() => [] as CatalogEntry[]),
    ])
      .then(([records, catalogEntries]) => {
        if (!active) return;
        setModels(records);
        const map: Record<string, CatalogEntry> = {};
        for (const entry of catalogEntries) {
          map[entry.id] = entry;
        }
        setCatalogMap(map);
      })
      .catch((e) => {
        if (active) setLoadError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);

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
        value={selectedModelId ?? undefined}
        onValueChange={handleChange}
        disabled={busy}
      >
        <SelectTrigger
          aria-label="Select model"
          className={cn(
            'h-8 rounded-xl px-2.5 text-xs bg-obsidian-850/90 border border-white/[0.08] hover:border-white/[0.18] transition-colors min-w-[120px] max-w-[200px] truncate',
            triggerClassName
          )}
        >
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => {
            const familyName = getModelFamilyName(m.entry_id, catalogMap);
            return (
              <SelectItem key={m.entry_id} value={m.entry_id} title={m.entry_id}>
                <span className="truncate max-w-[240px] block font-medium">
                  {familyName}
                </span>
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
