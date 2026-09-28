import { describe, it, expect } from 'vitest';
import {
  defaultParams,
  newMessage,
  newSession,
  clampTemperature,
  clampMaxTokens,
  validateSession,
  generateTitle,
  cleanGeneratedTitle,
  generateHeuristicTitle,
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

  describe('cleanGeneratedTitle', () => {
    it('strips surrounding quotes and markdown', () => {
      expect(cleanGeneratedTitle('"Grouped Query Attention"')).toBe('Grouped Query Attention');
      expect(cleanGeneratedTitle("'Rust Binary Search'")).toBe('Rust Binary Search');
      expect(cleanGeneratedTitle('```\nPython CSV Parser\n```')).toBe('Python CSV Parser');
      expect(cleanGeneratedTitle('### Docker Compose Guide')).toBe('Docker Compose Guide');
    });

    it('strips common prefixes and trailing punctuation', () => {
      expect(cleanGeneratedTitle('Title: Understanding GQA.')).toBe('Understanding GQA');
      expect(cleanGeneratedTitle('Topic: Memory Management!')).toBe('Memory Management');
      expect(cleanGeneratedTitle('Subject: Quantization Methods:')).toBe('Quantization Methods');
    });

    it('returns New Chat when input is empty or invalid', () => {
      expect(cleanGeneratedTitle('')).toBe('New Chat');
      expect(cleanGeneratedTitle('   ')).toBe('New Chat');
      expect(cleanGeneratedTitle(':::')).toBe('New Chat');
    });

    it('truncates at word boundary if exceeding 50 chars', () => {
      const longTitle = 'Comprehensive Architectural Overview of Large Language Models and Attention';
      const cleaned = cleanGeneratedTitle(longTitle);
      expect(cleaned.length).toBeLessThanOrEqual(53);
      expect(cleaned.endsWith('...')).toBe(true);
    });
  });

  describe('generateHeuristicTitle', () => {
    it('strips conversational question prefixes and capitalizes topic', () => {
      const msgs = [
        newMessage('user', 'Can you please explain how Grouped-Query Attention works?'),
      ];
      const title = generateHeuristicTitle(msgs);
      expect(title).toBe('Grouped-Query Attention works');
    });

    it('cleans code snippets and markdown syntax', () => {
      const msgs = [
        newMessage('user', 'How do I fix ```rust fn main() {} ``` compiler error?'),
      ];
      const title = generateHeuristicTitle(msgs);
      expect(title).toBe('Fix compiler error');
    });

    it('truncates long user prompts cleanly at word boundaries', () => {
      const msgs = [
        newMessage(
          'user',
          'Write a complete implementation of a red-black tree with insertion, deletion, and balancing in Rust'
        ),
      ];
      const title = generateHeuristicTitle(msgs);
      expect(title.length).toBeLessThanOrEqual(42);
      expect(title.endsWith('...')).toBe(true);
      expect(title.includes('  ')).toBe(false);
    });

    it('returns New Chat for empty conversation', () => {
      expect(generateHeuristicTitle([])).toBe('New Chat');
      expect(generateHeuristicTitle([newMessage('assistant', 'Hello')])).toBe('New Chat');
    });
  });

  describe('newSession flags', () => {
    it('initializes title flags to false', () => {
      const sess = newSession('test-model');
      expect(sess.isCustomTitle).toBe(false);
      expect(sess.hasAutoGeneratedTitle).toBe(false);
    });
  });
});
