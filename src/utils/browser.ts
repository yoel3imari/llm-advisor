import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * Opens an external URL in the system's default browser.
 * Uses `@tauri-apps/plugin-opener` on native desktop platforms,
 * and falls back gracefully to `window.open` in mock/browser environments.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch (err) {
    console.warn(
      `Failed to open URL "${url}" via @tauri-apps/plugin-opener, falling back to window.open:`,
      err
    );
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (fallbackErr) {
      console.error('Failed to open URL via window.open fallback:', fallbackErr);
    }
  }
}
