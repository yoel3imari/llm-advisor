import { useEffect, useState } from 'react';
import { isTauriEnvironment } from '../lib/utils';

/**
 * Tracks whether the current Tauri window is maximized.
 *
 * The custom title bar and the window resize handles both need this state, so
 * it is resolved once at the app shell instead of once per component.
 */
export function useWindowMaximized(): boolean {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriEnvironment()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();

        const sync = async () => {
          try {
            const maximized = await appWindow.isMaximized();
            if (!cancelled) setIsMaximized(maximized);
          } catch {
            // Ignore transient failures while the window is being created/destroyed.
          }
        };

        await sync();
        unlisten = await appWindow.onResized(() => {
          // Resize fires continuously while dragging; debounce the IPC probe.
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => void sync(), 100);
        });

        if (cancelled) unlisten();
      } catch (err) {
        console.debug('Unable to track window maximized state:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      unlisten?.();
    };
  }, []);

  return isMaximized;
}
