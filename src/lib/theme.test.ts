import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  applyTheme,
  toggleTheme,
  THEME_STORAGE_KEY,
} from './theme';

describe('Theme utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('defaults to system when localStorage is empty', () => {
    expect(getStoredTheme()).toBe('system');
  });

  it('reads the stored theme preference from localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(getStoredTheme()).toBe('light');

    localStorage.setItem(THEME_STORAGE_KEY, 'system');
    expect(getStoredTheme()).toBe('system');
  });

  it('resolves the system theme from prefers-color-scheme', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-color-scheme: dark'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList
    );

    expect(getSystemTheme()).toBe('dark');
    expect(resolveTheme('system')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('applies light theme to documentElement and saves to localStorage', () => {
    applyTheme('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('applies dark theme to documentElement and saves to localStorage', () => {
    // First set light, then switch to dark
    applyTheme('light');
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('applies the resolved system theme while storing the system preference', () => {
    applyTheme('system');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('toggles theme properly between dark and light', () => {
    applyTheme('dark');
    const next = toggleTheme('dark');
    expect(next).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    const backToDark = toggleTheme('light');
    expect(backToDark).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
