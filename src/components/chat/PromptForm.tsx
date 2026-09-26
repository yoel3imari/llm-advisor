import * as React from 'react';
import { ArrowRight, Square, SlidersHorizontal } from 'lucide-react';
import { Textarea } from '../ui/Textarea';
import { cn } from '../../lib/utils';

export interface PromptFormProps {
  onSend: (content: string) => void;
  onCancel: () => void;
  isSending?: boolean;
  hasModel?: boolean;
  onOpenParams?: () => void;
  modelSelector?: React.ReactNode;
  className?: string;
}

export function PromptForm({
  onSend,
  onCancel,
  isSending = false,
  hasModel = true,
  onOpenParams,
  modelSelector,
  className,
}: PromptFormProps) {
  const [value, setValue] = React.useState('');
  const areaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resize = React.useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  React.useEffect(() => {
    resize();
  }, [value, resize]);

  const canSend = value.trim().length > 0 && !isSending && hasModel;

  const submit = () => {
    const text = value.trim();
    if (!text || isSending || !hasModel) return;
    onSend(text);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={cn(
        'relative rounded-2xl bg-obsidian-900/90 backdrop-blur-xl border border-white/[0.12] p-3 focus-within:border-telemetry-500/50 focus-within:ring-1 focus-within:ring-telemetry-500/20 transition-all',
        className
      )}
    >
      <Textarea
        ref={areaRef}
        aria-label="Chat input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          hasModel ? 'Type a message... (Enter to send)' : 'Select a model to start chatting'
        }
        disabled={!hasModel || isSending}
        rows={2}
        className="max-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0 text-zinc-100 placeholder:text-zinc-500 p-1 text-sm leading-relaxed outline-none"
      />

      <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          {modelSelector}
          {onOpenParams && (
            <button
              type="button"
              onClick={onOpenParams}
              aria-label="Parameters"
              title="Parameters"
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white bg-obsidian-850 hover:bg-obsidian-800 border border-white/[0.08] hover:border-white/[0.18] transition-all hardware-button-tactile shrink-0"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-telemetry-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden sm:inline text-[10px] text-zinc-500 font-mono">
            ⏎ send · ⇧⏎ newline
          </span>
          <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
            {value.length} chars
          </span>
          {isSending ? (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Stop generating"
              title="Stop generating"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-laser-600 hover:bg-laser-500 text-white hardware-button-tactile shrink-0 transition-all"
            >
              <Square className="h-3.5 w-3.5 fill-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
              title="Send message"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-telemetry-500 hover:bg-telemetry-400 text-obsidian-950 font-bold disabled:opacity-30 disabled:cursor-not-allowed hardware-button-tactile shrink-0 transition-all"
            >
              <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
