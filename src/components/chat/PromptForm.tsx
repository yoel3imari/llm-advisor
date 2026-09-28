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
        'relative rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-3 shadow-corporate focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all',
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
        className="max-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 p-1 text-sm leading-relaxed outline-none shadow-none"
      />

      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          {modelSelector}
          {onOpenParams && (
            <button
              type="button"
              onClick={onOpenParams}
              aria-label="Parameters"
              title="Parameters"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:-translate-y-0.5 shrink-0"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden sm:inline text-[10px] text-slate-400 font-mono">
            ⏎ send · ⇧⏎ newline
          </span>
          <span className="text-[10px] text-slate-400 font-mono tabular-nums">
            {value.length} chars
          </span>
          {isSending ? (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Stop generating"
              title="Stop generating"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white shadow-sm hover:-translate-y-0.5 shrink-0 transition-all"
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
              className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed shadow-corporate-btn hover:-translate-y-0.5 active:translate-y-0 shrink-0 transition-all"
            >
              <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
