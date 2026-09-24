import * as React from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import { Slider } from '../ui/Slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { cn } from '../../lib/utils';
import { clampTemperature, type ChatParams } from '../../types/chat';

const SYSTEM_PROMPT_LIMIT = 8000;
const CONTEXT_OPTIONS = [2048, 4096, 8192, 16384, 32768];

export function ParamsPanel({
  params,
  onChange,
  defaultOpen = false,
}: {
  params: ChatParams;
  onChange: (params: ChatParams) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const overLimit = params.systemPrompt.length >= SYSTEM_PROMPT_LIMIT;

  const handleSystemChange = (value: string) => {
    onChange({ ...params, systemPrompt: value.slice(0, SYSTEM_PROMPT_LIMIT) });
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <Button
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Toggle parameters panel"
        className="w-full justify-between px-3"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Parameters
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
        />
      </Button>

      {open && (
        <div className="space-y-4 border-t border-zinc-800 p-3">
          <div className="space-y-1.5">
            <label
              htmlFor="chat-system-prompt"
              className="text-xs font-medium text-zinc-300"
            >
              System prompt
            </label>
            <Textarea
              id="chat-system-prompt"
              value={params.systemPrompt}
              onChange={(e) => handleSystemChange(e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={3}
              className="resize-none"
            />
            <p
              className={cn(
                'text-right text-[10px]',
                overLimit ? 'text-red-400' : 'text-zinc-500'
              )}
            >
              {params.systemPrompt.length} / {SYSTEM_PROMPT_LIMIT}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="chat-temperature"
              className="flex items-center justify-between text-xs font-medium text-zinc-300"
            >
              Temperature
              <span className="font-mono text-zinc-400">
                {params.temperature.toFixed(1)}
              </span>
            </label>
            <Slider
              id="chat-temperature"
              aria-label="Temperature"
              min={0}
              max={2}
              step={0.1}
              value={[params.temperature]}
              onValueChange={([v]) => onChange({ ...params, temperature: clampTemperature(v) })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="chat-context-size"
                className="text-xs font-medium text-zinc-300"
              >
                Context
              </label>
              <Select
                value={String(params.contextSize)}
                onValueChange={(v) => onChange({ ...params, contextSize: Number(v) })}
              >
                <SelectTrigger id="chat-context-size" aria-label="Context size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTEXT_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="chat-max-tokens"
                className="text-xs font-medium text-zinc-300"
              >
                Max tokens
              </label>
              <Input
                id="chat-max-tokens"
                type="number"
                min={1}
                max={32768}
                value={params.maxTokens}
                onChange={(e) =>
                  onChange({ ...params, maxTokens: Number(e.target.value) || 1 })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
