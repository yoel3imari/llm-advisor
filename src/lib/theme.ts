import type { ThemeMode } from '../types/domain';

export const THEME_STORAGE_KEY = 'llm_advisor_theme';

/**
 * Retrieves the stored theme preference from localStorage, falling back to 'dark'.
 */
export function getStoredTheme(): ThemeMode {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    }
  } catch {
    // Ignore localStorage access failures in restricted environments
  }
  return 'light';
}

/**
 * Applies the specified theme to the document element classList and syncs to localStorage.
 */
export function applyTheme(theme: ThemeMode): void {
  try {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
        root.setAttribute('data-theme', 'light');
      } else {
        root.classList.remove('light');
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Ignore DOM or localStorage errors
  }
}

/**
 * Toggles between dark and light theme, applies the change, and returns the new theme.
 */
export function toggleTheme(current?: ThemeMode): ThemeMode {
  const currentTheme = current ?? getStoredTheme();
  const nextTheme: ThemeMode = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(nextTheme);
  return nextTheme;
}
