import { describe, it, expect } from 'vitest';
import { countTokens } from '@svton/agent-core';

describe('countTokens', () => {
  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('counts English text: "hello" = ceil(5/4) = 2', () => {
    expect(countTokens('hello')).toBe(2);
  });

  it('counts Chinese text: "你好世界" = ceil(4/2) = 2', () => {
    expect(countTokens('你好世界')).toBe(2);
  });

  it('counts mixed text: "hello你好" = ceil(2/2 + 5/4) = ceil(1 + 1.25) = 3', () => {
    expect(countTokens('hello你好')).toBe(3);
  });

  it('gives a reasonable count for long text', () => {
    const text = 'The quick brown fox jumps over the lazy dog. ' + '快捷的棕色狐狸跳过了懒狗。'.repeat(10);
    const tokens = countTokens(text);
    expect(tokens).toBeGreaterThan(0);
    // Should be roughly proportional to length (within an order of magnitude)
    expect(tokens).toBeLessThan(text.length);
  });

  it('counts Japanese hiragana: "こんにちは" = ceil(5/2) = 3', () => {
    expect(countTokens('こんにちは')).toBe(3);
  });

  it('counts numbers and punctuation', () => {
    // "12345" = ceil(5/4) = 2 (all non-CJK)
    expect(countTokens('12345')).toBe(2);
    // "!@#$%" = ceil(5/4) = 2 (all non-CJK)
    expect(countTokens('!@#$%')).toBe(2);
    // Mixed numbers with CJK: "abc你好123" = ceil(2/2 + 6/4) = ceil(1 + 1.5) = 3
    expect(countTokens('abc你好123')).toBe(3);
  });
});
