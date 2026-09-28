import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getStoredTheme, applyTheme, toggleTheme, THEME_STORAGE_KEY } from './theme';

describe('Theme utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light when localStorage is empty', () => {
    expect(getStoredTheme()).toBe('light');
  });

  it('reads light theme from localStorage if previously stored', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(getStoredTheme()).toBe('light');
  });

  it('applies light theme to documentElement and saves to localStorage', () => {
    applyTheme('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('applies dark theme to documentElement and saves to localStorage', () => {
    // First set light, then switch to dark
    applyTheme('light');
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
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
