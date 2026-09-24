import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSessions,
  saveSessions,
  saveSession,
  deleteSession,
  clearSessions,
  STORAGE_KEY,
  CORRUPT_BACKUP_KEY,
} from './chat-store';
import type { ChatSession } from '../types/chat';

function createMockSession(id: string, overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id,
    modelId: 'test-model',
    title: `Title ${id}`,
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: `Prompt for ${id}`,
        createdAt: '2026-09-24T10:00:00Z',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: `Reply for ${id}`,
        createdAt: '2026-09-24T10:00:02Z',
      },
    ],
    params: {
      systemPrompt: 'You are helpful',
      temperature: 0.8,
      contextSize: 8192,
      maxTokens: 2048,
    },
    createdAt: '2026-09-24T10:00:00Z',
    updatedAt: '2026-09-24T10:00:05Z',
    ...overrides,
  };
}

describe('chat-store persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('roundtrips sessions to localStorage and preserves params and messages', () => {
    const s1 = createMockSession('s1', { title: 'First Session' });
    const s2 = createMockSession('s2', { title: 'Second Session' });

    saveSessions([s1, s2]);

    const loaded = loadSessions();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('s1');
    expect(loaded[0].params.temperature).toBe(0.8);
    expect(loaded[0].params.systemPrompt).toBe('You are helpful');
    expect(loaded[1].id).toBe('s2');
  });

  it('handles corrupt JSON gracefully by returning empty array and writing backup key', () => {
    const badJson = '{bad json syntax';
    localStorage.setItem(STORAGE_KEY, badJson);

    const loaded = loadSessions();
    expect(loaded).toEqual([]);
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBe(badJson);
  });

  it('filters out malformed session objects in storage', () => {
    const s1 = createMockSession('s1');
    const malformed = { id: 123, broken: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([s1, malformed]));

    const loaded = loadSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('s1');
  });

  it('upserts session with saveSession', () => {
    const s1 = createMockSession('s1', { title: 'Initial Title' });
    saveSession(s1);

    expect(loadSessions()).toHaveLength(1);
    expect(loadSessions()[0].title).toBe('Initial Title');

    const updated = { ...s1, title: 'Updated Title' };
    saveSession(updated);

    const reloaded = loadSessions();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].title).toBe('Updated Title');
  });

  it('deletes session with deleteSession', () => {
    const s1 = createMockSession('s1');
    const s2 = createMockSession('s2');
    saveSessions([s1, s2]);

    deleteSession('s1');
    const loaded = loadSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('s2');
  });

  it('clears all sessions', () => {
    saveSession(createMockSession('s1'));
    clearSessions();
    expect(loadSessions()).toEqual([]);
  });

  it('caps sessions to max limit (e.g. 30) by trimming oldest', () => {
    const manySessions: ChatSession[] = [];
    for (let i = 0; i < 35; i++) {
      const pad = String(i).padStart(2, '0');
      manySessions.push(
        createMockSession(`s-${pad}`, {
          updatedAt: `2026-09-24T12:${pad}:00Z`,
        })
      );
    }

    saveSessions(manySessions);
    const loaded = loadSessions();
    expect(loaded.length).toBeLessThanOrEqual(30);
    // Newest sessions (s-34, s-33...) should be kept
    expect(loaded.some((s) => s.id === 's-34')).toBe(true);
    expect(loaded.some((s) => s.id === 's-00')).toBe(false);
  });
});
