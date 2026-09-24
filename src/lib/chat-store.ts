import { validateSession, type ChatSession } from '../types/chat';

export const STORAGE_KEY = 'llm-advisor.chat.sessions.v1';
export const CORRUPT_BACKUP_KEY = 'llm-advisor.chat.sessions.v1.corrupt-backup';
export const MAX_SESSIONS = 30;
export const MAX_BYTES = 4 * 1024 * 1024; // 4 MB safety limit for webview localStorage

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupt JSON: preserve backup and reset gracefully
      try {
        localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
      } catch {
        /* ignore backup failure */
      }
      return [];
    }

    if (!Array.isArray(parsed)) {
      try {
        localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
      } catch {
        /* ignore */
      }
      return [];
    }

    const validSessions: ChatSession[] = [];
    for (const item of parsed) {
      if (validateSession(item)) {
        validSessions.push(item);
      }
    }

    return validSessions;
  } catch (err) {
    console.warn('Failed to load chat sessions from localStorage:', err);
    return [];
  }
}

function pruneSessions(sessions: ChatSession[]): ChatSession[] {
  // Sort descending by updatedAt
  const sorted = [...sessions].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt).getTime();
    return timeB - timeA;
  });

  // Limit count to MAX_SESSIONS
  let current = sorted.slice(0, MAX_SESSIONS);

  // Check size in bytes
  let serialized = JSON.stringify(current);
  while (serialized.length > MAX_BYTES && current.length > 1) {
    current = current.slice(0, current.length - 1);
    serialized = JSON.stringify(current);
  }

  return current;
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    const pruned = pruneSessions(sessions);
    const serialized = JSON.stringify(pruned);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    // If QuotaExceededError, try pruning more aggressively
    try {
      const halved = sessions.slice(0, Math.max(1, Math.floor(sessions.length / 2)));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(halved));
    } catch {
      console.error('Failed to save chat sessions to localStorage quota exceeded', err);
    }
  }
}

export function saveSession(session: ChatSession): void {
  const existing = loadSessions();
  const index = existing.findIndex((s) => s.id === session.id);
  let updated: ChatSession[];
  if (index >= 0) {
    updated = [...existing];
    updated[index] = session;
  } else {
    updated = [session, ...existing];
  }
  saveSessions(updated);
}

export function deleteSession(sessionId: string): void {
  const existing = loadSessions();
  const filtered = existing.filter((s) => s.id !== sessionId);
  saveSessions(filtered);
}

export function clearSessions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear sessions', err);
  }
}
