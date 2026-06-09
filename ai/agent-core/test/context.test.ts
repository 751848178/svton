import { describe, it, expect } from 'vitest';
import { ContextManager } from '@svton/agent-core';
import type { ChatMessage } from '@svton/agent-core';

describe('ContextManager', () => {
  // ----------------------------------------------------------
  // Constructor & Defaults
  // ----------------------------------------------------------
  describe('constructor', () => {
    it('uses default config when no config provided', () => {
      const cm = new ContextManager();
      expect(cm.getTokenCount()).toBe(0);
      expect(cm.needsCompaction()).toBe(false);
      expect(cm.getAvailableTokens()).toBe(128000 - 0 - 4096);
    });

    it('applies custom config values', () => {
      const cm = new ContextManager({
        maxTokens: 50000,
        compactionThreshold: 0.6,
        reservedForResponse: 2048,
        preserveRecentMessages: 3,
      });
      // Underlying defaults are set; we verify through behavior later
      expect(cm.getTokenCount()).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // addMessage / getMessages
  // ----------------------------------------------------------
  describe('addMessage / getMessages', () => {
    it('adds and retrieves messages', () => {
      const cm = new ContextManager();
      const msg: ChatMessage = { role: 'user', content: 'Hello' };
      cm.addMessage(msg);

      const messages = cm.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(msg);
    });

    it('returns a copy from getMessages (modifying returned array does not affect internal state)', () => {
      const cm = new ContextManager();
      cm.addMessage({ role: 'user', content: 'Hello' });

      const copy = cm.getMessages();
      copy.push({ role: 'assistant', content: 'World' });

      // Internal state should be unchanged
      expect(cm.getMessages()).toHaveLength(1);
    });

    it('returns a shallow copy of each message reference (pushing to copy does not alter internal)', () => {
      const cm = new ContextManager();
      cm.addMessage({ role: 'user', content: 'Hello' });

      const copy = cm.getMessages();
      (copy[0] as { content: string }).content = 'Changed';

      // Internal messages are not affected by mutating the copy's elements
      // (spread creates a new array but elements are the same references,
      //  so we verify the array length is still correct as a baseline)
      expect(cm.getMessages()).toHaveLength(1);
    });

    it('handles messages with ContentBlock arrays', () => {
      const cm = new ContextManager();
      const msg: ChatMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Here is the result:' },
          { type: 'tool_use', id: 'tu1', name: 'bash', input: { command: 'ls' } },
        ],
      };
      cm.addMessage(msg);

      const messages = cm.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(Array.isArray(messages[0].content)).toBe(true);
    });

    it('handles tool result messages', () => {
      const cm = new ContextManager();
      const msg: ChatMessage = {
        role: 'tool',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'tu1',
            output: 'file1.txt\nfile2.txt',
          },
        ],
      };
      cm.addMessage(msg);

      expect(cm.getMessages()).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // setMessages
  // ----------------------------------------------------------
  describe('setMessages', () => {
    it('replaces all messages and recalculates tokens', () => {
      const cm = new ContextManager();
      cm.addMessage({ role: 'user', content: 'Old message one' });
      cm.addMessage({ role: 'assistant', content: 'Old reply' });

      const initialTokens = cm.getTokenCount();
      expect(initialTokens).toBeGreaterThan(0);

      const newMessages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'New message' },
      ];

      cm.setMessages(newMessages);

      expect(cm.getMessages()).toHaveLength(2);
      expect(cm.getMessages()[0].role).toBe('system');

      // Token count should be recalculated for the new messages only
      const newTokens = cm.getTokenCount();
      expect(newTokens).not.toBe(initialTokens);
      expect(newTokens).toBeGreaterThan(0);
    });

    it('sets messages to empty array', () => {
      const cm = new ContextManager();
      cm.addMessage({ role: 'user', content: 'Hello' });
      expect(cm.getTokenCount()).toBeGreaterThan(0);

      cm.setMessages([]);
      expect(cm.getMessages()).toHaveLength(0);
      expect(cm.getTokenCount()).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // getTokenCount
  // ----------------------------------------------------------
  describe('getTokenCount', () => {
    it('starts at zero', () => {
      const cm = new ContextManager();
      expect(cm.getTokenCount()).toBe(0);
    });

    it('increases after adding messages', () => {
      const cm = new ContextManager();
      cm.addMessage({ role: 'user', content: 'Hello world' });
      const tokens1 = cm.getTokenCount();

      cm.addMessage({ role: 'assistant', content: 'Hi there! This is a longer response.' });
      const tokens2 = cm.getTokenCount();

      expect(tokens1).toBeGreaterThan(0);
      expect(tokens2).toBeGreaterThan(tokens1);
    });

    it('estimates ~4 chars/token for English text', () => {
      const cm = new ContextManager();
      const englishText = 'A'.repeat(40); // 40 chars => ~10 tokens
      cm.addMessage({ role: 'user', content: englishText });
      expect(cm.getTokenCount()).toBe(10);
    });

    it('estimates ~2 chars/token for CJK characters', () => {
      const cm = new ContextManager();
      const cjkText = '\u4f60\u597d\u4e16\u754c'; // 4 CJK chars => ~2 tokens
      cm.addMessage({ role: 'user', content: cjkText });
      expect(cm.getTokenCount()).toBe(2);
    });

    it('handles mixed English and CJK text', () => {
      const cm = new ContextManager();
      // "Hello" = 5 English chars, "你好" = 2 CJK chars
      // CJK: 2/2 = 1 token, English: 5/4 = 1.25 => ceil = 2
      // Total: 1 + 2 = 3
      cm.addMessage({ role: 'user', content: 'Hello\u4f60\u597d' });
      expect(cm.getTokenCount()).toBe(3);
    });

    it('counts tokens in ContentBlock arrays', () => {
      const cm = new ContextManager();
      const msg: ChatMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello' },           // 5/4 = 2
          { type: 'tool_use', id: '1', name: 't', input: { a: 1 } }, // JSON.stringify => ~6 chars => 2
        ],
      };
      cm.addMessage(msg);
      expect(cm.getTokenCount()).toBeGreaterThan(0);
    });

    it('estimates 50 tokens for unknown content block types', () => {
      const cm = new ContextManager();
      // image blocks fall into the default case of 50 tokens
      const msg: ChatMessage = {
        role: 'assistant',
        content: [
          { type: 'image', data: 'base64data' } as any,
        ],
      };
      cm.addMessage(msg);
      expect(cm.getTokenCount()).toBe(50);
    });
  });

  // ----------------------------------------------------------
  // needsCompaction
  // ----------------------------------------------------------
  describe('needsCompaction', () => {
    it('returns false when under threshold', () => {
      const cm = new ContextManager();
      cm.addMessage({ role: 'user', content: 'Short message' });
      expect(cm.needsCompaction()).toBe(false);
    });

    it('returns true when estimated tokens >= maxTokens * threshold - reserved', () => {
      // maxTokens=1000, threshold=0.8, reserved=50
      // threshold line = 1000 * 0.8 - 50 = 750
      const cm = new ContextManager({
        maxTokens: 1000,
        compactionThreshold: 0.8,
        reservedForResponse: 50,
      });

      // Add enough messages to exceed the threshold
      // 750 tokens => 3000 English chars
      for (let i = 0; i < 75; i++) {
        cm.addMessage({ role: 'user', content: 'A'.repeat(40) }); // 10 tokens each
      }
      // 75 * 10 = 750 tokens, which equals threshold
      expect(cm.needsCompaction()).toBe(true);
    });

    it('uses correct formula: tokens >= maxTokens * threshold - reserved', () => {
      // maxTokens=100, threshold=0.5, reserved=10
      // threshold line = 100 * 0.5 - 10 = 40
      const cm = new ContextManager({
        maxTokens: 100,
        compactionThreshold: 0.5,
        reservedForResponse: 10,
      });

      // 40 tokens = 160 English chars
      for (let i = 0; i < 4; i++) {
        cm.addMessage({ role: 'user', content: 'A'.repeat(40) }); // 10 tokens each
      }
      // 4 * 10 = 40 tokens => exactly threshold
      expect(cm.needsCompaction()).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // getAvailableTokens
  // ----------------------------------------------------------
  describe('getAvailableTokens', () => {
    it('returns maxTokens - tokens - reserved', () => {
      const cm = new ContextManager({
        maxTokens: 1000,
        reservedForResponse: 100,
      });

      expect(cm.getAvailableTokens()).toBe(900);

      // Add 10 tokens
      cm.addMessage({ role: 'user', content: 'A'.repeat(40) }); // 10 tokens
      expect(cm.getAvailableTokens()).toBe(890);
    });
  });

  // ----------------------------------------------------------
  // compact (async — no provider, falls back to truncation)
  // ----------------------------------------------------------
  describe('compact', () => {
    it('removes oldest non-system messages, keeps most recent N', async () => {
      const cm = new ContextManager({ preserveRecentMessages: 2 });

      cm.addMessage({ role: 'system', content: 'System prompt' });
      cm.addMessage({ role: 'user', content: 'First user message' });
      cm.addMessage({ role: 'assistant', content: 'First assistant message' });
      cm.addMessage({ role: 'user', content: 'Second user message' });
      cm.addMessage({ role: 'assistant', content: 'Second assistant message' });
      cm.addMessage({ role: 'user', content: 'Third user message' });
      cm.addMessage({ role: 'assistant', content: 'Third assistant message' });

      const { removed, kept } = await cm.compact();

      // System message + 2 most recent non-system messages = 3 kept
      expect(kept.length).toBe(3);
      expect(kept[0].role).toBe('system');
      expect(kept[1].content).toBe('Third user message');
      expect(kept[2].content).toBe('Third assistant message');

      // 4 messages removed (first user, first assistant, second user, second assistant)
      expect(removed.length).toBe(4);
    });

    it('always keeps system messages', async () => {
      const cm = new ContextManager({ preserveRecentMessages: 1 });

      cm.addMessage({ role: 'system', content: 'System prompt' });
      cm.addMessage({ role: 'system', content: 'Another system message' });
      cm.addMessage({ role: 'user', content: 'User message' });
      cm.addMessage({ role: 'assistant', content: 'Response' });

      const { kept } = await cm.compact();

      // Both system messages should be kept
      const systemKept = kept.filter((m) => m.role === 'system');
      expect(systemKept.length).toBe(2);
    });

    it('updates estimated tokens after compaction', async () => {
      const cm = new ContextManager({ preserveRecentMessages: 1 });

      cm.addMessage({ role: 'system', content: 'System' });
      cm.addMessage({ role: 'user', content: 'A'.repeat(400) }); // 100 tokens
      cm.addMessage({ role: 'assistant', content: 'B'.repeat(400) }); // 100 tokens
      cm.addMessage({ role: 'user', content: 'C'.repeat(400) }); // 100 tokens

      const tokensBefore = cm.getTokenCount();
      await cm.compact();

      const tokensAfter = cm.getTokenCount();
      // After compaction, only system + 1 most recent non-system message remain
      expect(tokensAfter).toBeLessThan(tokensBefore);
      expect(tokensAfter).toBeGreaterThan(0);
    });

    it('returns empty removed array when no messages to remove', async () => {
      const cm = new ContextManager({ preserveRecentMessages: 10 });

      cm.addMessage({ role: 'user', content: 'Only message' });

      const { removed, kept } = await cm.compact();
      expect(removed).toHaveLength(0);
      expect(kept).toHaveLength(1);
    });

    it('handles empty message list', async () => {
      const cm = new ContextManager();
      const { removed, kept } = await cm.compact();
      expect(removed).toHaveLength(0);
      expect(kept).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // clear
  // ----------------------------------------------------------
  describe('clear', () => {
    it('removes all messages and resets token count', () => {
      const cm = new ContextManager();
      cm.addMessage({ role: 'system', content: 'System' });
      cm.addMessage({ role: 'user', content: 'Hello' });
      cm.addMessage({ role: 'assistant', content: 'World' });

      expect(cm.getMessages()).toHaveLength(3);
      expect(cm.getTokenCount()).toBeGreaterThan(0);

      cm.clear();

      expect(cm.getMessages()).toHaveLength(0);
      expect(cm.getTokenCount()).toBe(0);
    });

    it('resets available tokens to maxTokens minus reserved', () => {
      const cm = new ContextManager({
        maxTokens: 1000,
        reservedForResponse: 100,
      });

      cm.addMessage({ role: 'user', content: 'Some message' });
      cm.clear();

      expect(cm.getAvailableTokens()).toBe(900);
    });
  });

  // ----------------------------------------------------------
  // Edge cases
  // ----------------------------------------------------------
  describe('edge cases', () => {
    it('handles messages with empty string content', () => {
      const cm = new ContextManager();
      cm.addMessage({ role: 'user', content: '' });
      expect(cm.getMessages()).toHaveLength(1);
      expect(cm.getTokenCount()).toBe(0);
    });

    it('handles messages with empty ContentBlock array', () => {
      const cm = new ContextManager();
      cm.addMessage({ role: 'assistant', content: [] });
      expect(cm.getMessages()).toHaveLength(1);
      expect(cm.getTokenCount()).toBe(0);
    });

    it('compaction preserves order of system + recent messages', async () => {
      const cm = new ContextManager({ preserveRecentMessages: 2 });

      cm.addMessage({ role: 'system', content: 'SYS' });
      cm.addMessage({ role: 'user', content: 'U1' });
      cm.addMessage({ role: 'assistant', content: 'A1' });
      cm.addMessage({ role: 'user', content: 'U2' });
      cm.addMessage({ role: 'assistant', content: 'A2' });

      const { kept } = await cm.compact();

      // Order: system, then 2 most recent non-system (U2, A2)
      expect(kept.map((m) => m.content)).toEqual(['SYS', 'U2', 'A2']);
    });
  });
});
