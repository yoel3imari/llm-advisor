import { AlertTriangle, RefreshCw, Play, ArrowRight, Info } from 'lucide-react';
import { Button } from '../ui/Button';

export interface ChatErrorsProps {
  error: { code: string; message: string } | null;
  contextWarning?: boolean;
  contextCritical?: boolean;
  contextTruncatedCount?: number;
  onStartModel?: () => void;
  onRegenerate?: () => void;
  onContinue?: () => void;
}

export function ChatErrors({
  error,
  contextWarning = false,
  contextCritical = false,
  contextTruncatedCount = 0,
  onStartModel,
  onRegenerate,
  onContinue,
}: ChatErrorsProps) {
  if (!error && !contextWarning && !contextCritical) {
    return null;
  }

  return (
    <div className="space-y-2 p-3">
      {/* Context limit warning banner */}
      {contextCritical ? (
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Context limit exceeded (&gt;95%).{' '}
              {contextTruncatedCount > 0
                ? `${contextTruncatedCount} older message${contextTruncatedCount > 1 ? 's were' : ' was'} truncated to fit.`
                : 'Older messages were truncated to fit.'}
            </span>
          </div>
        </div>
      ) : contextWarning ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs">
          <Info className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Context window is 80% full. Older messages may be truncated soon.</span>
        </div>
      ) : null}

      {/* IPC / Inference Errors */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-950/50 border border-red-800/80 text-red-200 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <div className="space-y-0.5">
              {error.code === 'NO_MODEL' ? (
                <p className="font-medium text-red-100">
                  No model serving — select and start a model to begin.
                </p>
              ) : error.code === 'SIDECAR_DIED' ? (
                <p className="font-medium text-red-100">
                  Inference server stopped unexpectedly. Partial response preserved.
                </p>
              ) : error.code === 'TIMEOUT' ? (
                <p className="font-medium text-red-100">
                  No tokens received from model — response timed out.
                </p>
              ) : (
                <p className="font-medium text-red-100">
                  {error.message || 'An error occurred during response generation.'}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {error.code === 'NO_MODEL' && onStartModel ? (
              <Button
                size="sm"
                onClick={onStartModel}
                className="bg-red-800 hover:bg-red-700 text-white text-xs h-7 px-2.5 flex items-center gap-1.5"
              >
                <Play className="h-3 w-3" />
                <span>Start Model</span>
              </Button>
            ) : error.code === 'SIDECAR_DIED' && onRegenerate ? (
              <Button
                size="sm"
                onClick={onRegenerate}
                className="bg-red-800 hover:bg-red-700 text-white text-xs h-7 px-2.5 flex items-center gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Regenerate</span>
              </Button>
            ) : error.code === 'TIMEOUT' && onContinue ? (
              <Button
                size="sm"
                onClick={onContinue}
                className="bg-amber-800 hover:bg-amber-700 text-white text-xs h-7 px-2.5 flex items-center gap-1.5"
              >
                <ArrowRight className="h-3 w-3" />
                <span>Continue</span>
              </Button>
            ) : onRegenerate ? (
              <Button
                size="sm"
                onClick={onRegenerate}
                className="bg-red-800 hover:bg-red-700 text-white text-xs h-7 px-2.5 flex items-center gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry</span>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
