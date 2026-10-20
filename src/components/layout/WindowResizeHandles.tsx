import { cn, isTauriEnvironment } from '../../lib/utils';

type WindowModule = typeof import('@tauri-apps/api/window');
type AppWindow = ReturnType<WindowModule['getCurrentWindow']>;
type ResizeDirection = Parameters<AppWindow['startResizeDragging']>[0];

interface ResizeHandle {
  direction: ResizeDirection;
  className: string;
}

// Edges first, corners second so the corners sit on top of the edge strips.
const RESIZE_HANDLES: ResizeHandle[] = [
  { direction: 'North', className: 'left-2 right-2 top-0 h-1.5 cursor-n-resize' },
  { direction: 'South', className: 'bottom-0 left-2 right-2 h-1.5 cursor-s-resize' },
  { direction: 'West', className: 'bottom-2 left-0 top-2 w-1.5 cursor-w-resize' },
  { direction: 'East', className: 'bottom-2 right-0 top-2 w-1.5 cursor-e-resize' },
  { direction: 'NorthWest', className: 'left-0 top-0 h-3 w-3 cursor-nw-resize' },
  { direction: 'NorthEast', className: 'right-0 top-0 h-3 w-3 cursor-ne-resize' },
  { direction: 'SouthWest', className: 'bottom-0 left-0 h-3 w-3 cursor-sw-resize' },
  { direction: 'SouthEast', className: 'bottom-0 right-0 h-3 w-3 cursor-se-resize' },
];

function startResize(direction: ResizeDirection) {
  if (!isTauriEnvironment()) return;

  import('@tauri-apps/api/window')
    .then(({ getCurrentWindow }) => getCurrentWindow().startResizeDragging(direction))
    .catch((err) => {
      console.debug('Unable to start window resize:', err);
    });
}

export interface WindowResizeHandlesProps {
  enabled?: boolean;
}

/**
 * Invisible edge and corner hit areas for the frameless window.
 *
 * `decorations: false` removes the native resize border, so these handles
 * restore edge resizing consistently on every platform.
 */
export function WindowResizeHandles({ enabled = true }: WindowResizeHandlesProps) {
  if (!enabled || !isTauriEnvironment()) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle.direction}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            startResize(handle.direction);
          }}
          className={cn('pointer-events-auto absolute', handle.className)}
        />
      ))}
    </div>
  );
}
