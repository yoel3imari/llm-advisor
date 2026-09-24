import * as React from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';

export function PromptForm({
  onSend,
  onCancel,
  isSending = false,
  hasModel = true,
}: {
  onSend: (content: string) => void;
  onCancel: () => void;
  isSending?: boolean;
  hasModel?: boolean;
}) {
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
    <div className="flex items-end gap-2">
      <div className="flex-1">
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
          className="max-h-[200px] resize-none"
        />
        <div className="mt-1 text-right text-[10px] text-zinc-500">
          {value.length} chars
        </div>
      </div>
      {isSending ? (
        <Button
          variant="destructive"
          onClick={onCancel}
          aria-label="Stop generating"
        >
          <Square className="h-3.5 w-3.5" />
          Stop
        </Button>
      ) : (
        <Button onClick={submit} disabled={!canSend} aria-label="Send message">
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      )}
    </div>
  );
}
