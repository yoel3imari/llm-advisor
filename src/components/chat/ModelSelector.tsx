import * as React from 'react';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { Badge } from '../ui/Badge';
import { listLibraryModels, startServer } from '../../ipc/commands';
import type { ModelRecord } from '../../types/domain';

export function ModelSelector({
  selectedModelId,
  runningModelId = null,
  isStreaming = false,
  contextSize = 4096,
  onSelect,
  onServerStarted,
}: {
  selectedModelId: string | null;
  runningModelId?: string | null;
  isStreaming?: boolean;
  contextSize?: number;
  onSelect: (modelId: string) => void;
  onServerStarted?: () => void;
}) {
  const [models, setModels] = React.useState<ModelRecord[]>([]);
  const [warming, setWarming] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    listLibraryModels()
      .then((records) => {
        if (active) setModels(records);
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
      <p className="text-xs text-zinc-500">
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
        <SelectTrigger aria-label="Select model" className="w-[220px]">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.entry_id} value={m.entry_id}>
              <span className="flex items-center gap-2">
                {m.entry_id}
                {m.entry_id === runningModelId && (
                  <Badge variant="success">Running</Badge>
                )}
              </span>
            </SelectItem>
          ))}
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
