import type { ThemeMode } from '../types/domain';
import { isTauriEnvironment } from './utils';

export const THEME_STORAGE_KEY = 'llm_advisor_theme';

export type ResolvedTheme = 'light' | 'dark';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

let activeTheme: ThemeMode = 'system';
let systemThemeListenerAttached = false;

/**
 * Returns the current operating system color scheme.
 */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Resolves a theme preference ('system' included) to a concrete light/dark value.
 */
export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

/**
 * Retrieves the stored theme preference from localStorage, falling back to 'system'.
 */
export function getStoredTheme(): ThemeMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    }
  } catch {
    // Ignore localStorage access failures in restricted environments
  }
  return 'system';
}

/**
 * Applies the specified theme preference to the document and the native window.
 * When 'system' is selected, the color scheme is resolved from the OS and kept in
 * sync while the operating system theme changes.
 */
export function applyTheme(theme: ThemeMode): ResolvedTheme {
  activeTheme = theme;
  const resolved = resolveTheme(theme);

  try {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.toggle('dark', resolved === 'dark');
      root.classList.toggle('light', resolved === 'light');
      root.setAttribute('data-theme', resolved);
      root.style.colorScheme = resolved;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Ignore DOM or localStorage errors
  }

  syncNativeWindowTheme(resolved);
  watchSystemTheme();

  return resolved;
}

/**
 * Toggles between dark and light theme, applies the change, and returns the new theme.
 * If the current preference is 'system', the opposite of the resolved system theme is used.
 */
export function toggleTheme(current?: ThemeMode): ThemeMode {
  const currentTheme = current ?? getStoredTheme();
  const nextTheme: ThemeMode = resolveTheme(currentTheme) === 'light' ? 'dark' : 'light';
  applyTheme(nextTheme);
  return nextTheme;
}

/**
 * Keeps the renderer and the native window theme in sync with OS theme changes.
 */
function watchSystemTheme(): void {
  if (
    systemThemeListenerAttached ||
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return;
  }

  systemThemeListenerAttached = true;
  const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
  const handleChange = () => {
    if (activeTheme === 'system') {
      applyTheme('system');
    }
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleChange);
  }
}

/**
 * Mirrors the resolved theme onto the native window so OS-drawn surfaces
 * (dialogs, menus and native scrollbars) match the app.
 */
function syncNativeWindowTheme(theme: ResolvedTheme): void {
  if (!isTauriEnvironment()) return;

  import('@tauri-apps/api/window')
    .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(theme))
    .catch((err) => {
      console.debug('Unable to apply native window theme:', err);
    });
}
