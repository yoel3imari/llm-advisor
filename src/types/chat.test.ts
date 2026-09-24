import { describe, it, expect } from 'vitest';
import {
  defaultParams,
  newMessage,
  newSession,
  clampTemperature,
  clampMaxTokens,
  validateSession,
  generateTitle,
} from './chat';

describe('chat types', () => {
  describe('defaultParams', () => {
    it('returns sensible defaults', () => {
      const params = defaultParams();
      expect(params.temperature).toBe(0.7);
      expect(params.contextSize).toBe(4096);
      expect(params.maxTokens).toBe(2048);
      expect(params.systemPrompt).toBe('');
    });
  });

  describe('newMessage', () => {
    it('creates message with uuid and timestamp', () => {
      const msg = newMessage('user', 'Hello');
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
      expect(msg.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(new Date(msg.createdAt).getTime()).not.toBeNaN();
    });
  });

  describe('newSession', () => {
    it('creates session with unique id and empty messages', () => {
      const session = newSession('model-1');
      expect(session.modelId).toBe('model-1');
      expect(session.messages).toHaveLength(0);
      expect(session.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(session.params).toEqual(defaultParams());
    });

    it('generates unique ids for different sessions', () => {
      const a = newSession('model-1');
      const b = newSession('model-1');
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('clampTemperature', () => {
    it('clamps to [0, 2] range', () => {
      expect(clampTemperature(0.7)).toBe(0.7);
      expect(clampTemperature(-1)).toBe(0);
      expect(clampTemperature(5)).toBe(2);
      expect(clampTemperature(0)).toBe(0);
      expect(clampTemperature(2)).toBe(2);
    });
  });

  describe('clampMaxTokens', () => {
    it('clamps to [1, 32768] range', () => {
      expect(clampMaxTokens(2048)).toBe(2048);
      expect(clampMaxTokens(0)).toBe(1);
      expect(clampMaxTokens(99999)).toBe(32768);
    });
  });

  describe('validateSession', () => {
    it('accepts valid session object', () => {
      const session = newSession('model-1');
      expect(validateSession(session)).toBe(true);
    });

    it('rejects null', () => {
      expect(validateSession(null)).toBe(false);
    });

    it('rejects missing fields', () => {
      expect(validateSession({ id: 'x' })).toBe(false);
    });

    it('rejects non-object', () => {
      expect(validateSession('string')).toBe(false);
      expect(validateSession(42)).toBe(false);
    });
  });

  describe('generateTitle', () => {
    it('uses first user message content', () => {
      const msgs = [newMessage('user', 'Explain GQA'), newMessage('assistant', 'GQA...')];
      expect(generateTitle(msgs)).toBe('Explain GQA');
    });

    it('truncates at 40 chars', () => {
      const long = 'A'.repeat(60);
      const msgs = [newMessage('user', long)];
      const title = generateTitle(msgs);
      expect(title).toHaveLength(43);
      expect(title.endsWith('...')).toBe(true);
    });

    it('returns New Chat when no user messages', () => {
      expect(generateTitle([])).toBe('New Chat');
    });
  });
});
