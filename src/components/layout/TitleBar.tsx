import type { ReactNode } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { cn, isTauriEnvironment } from '../../lib/utils';

type WindowModule = typeof import('@tauri-apps/api/window');
type AppWindow = ReturnType<WindowModule['getCurrentWindow']>;

async function runWindowAction(action: (appWindow: AppWindow) => Promise<void>) {
  if (!isTauriEnvironment()) return;

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await action(getCurrentWindow());
  } catch (err) {
    console.debug('Window action failed:', err);
  }
}

interface WindowButtonProps {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}

function WindowButton({ label, onClick, danger = false, children }: WindowButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-full w-11 items-center justify-center transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/70',
        danger
          ? 'text-slate-500 hover:bg-rose-500 hover:text-white dark:text-slate-400 dark:hover:bg-rose-600 dark:hover:text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
      )}
    >
      {children}
    </button>
  );
}

export interface TitleBarProps {
  isMaximized?: boolean;
  className?: string;
}

/**
 * Frameless-window title bar shared by every OS so the chrome looks identical
 * on Windows, macOS and Linux. The whole bar is a drag region (`deep` makes
 * descendants draggable too) while interactive controls opt out automatically
 * because Tauri ignores clicks on buttons.
 */
export function TitleBar({ isMaximized = false, className }: TitleBarProps) {
  return (
    <header
      data-testid="app-titlebar"
      data-tauri-drag-region="deep"
      className={cn(
        'relative z-30 flex h-9 w-full shrink-0 select-none items-center justify-between border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5 px-3" aria-hidden="true">
        <img
          src="/app-icon.png"
          alt=""
          draggable={false}
          className="h-4 w-4 shrink-0 rounded-[4px] object-contain"
        />
        <span className="truncate text-[11px] font-semibold tracking-tight text-slate-600 dark:text-slate-300">
          ModelSift
        </span>
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(79,70,229,0.45)]" />
          <span className="text-[9px] font-mono font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            Local Inference
          </span>
        </span>
      </div>

      <div className="flex h-full shrink-0 items-stretch">
        <WindowButton
          label="Minimize window"
          onClick={() => void runWindowAction((appWindow) => appWindow.minimize())}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
        </WindowButton>
        <WindowButton
          label={isMaximized ? 'Restore window' : 'Maximize window'}
          onClick={() => void runWindowAction((appWindow) => appWindow.toggleMaximize())}
        >
          {isMaximized ? (
            <Copy className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
          ) : (
            <Square className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
          )}
        </WindowButton>
        <WindowButton
          label="Close window"
          danger
          onClick={() => void runWindowAction((appWindow) => appWindow.close())}
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
        </WindowButton>
      </div>
    </header>
  );
}
