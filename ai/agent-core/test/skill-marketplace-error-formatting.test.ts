import { describe, expect, it, vi } from 'vitest';
import { SkillMarketplace } from '../src/skill/marketplace';
import { MemoryStorage } from './helpers';

describe('SkillMarketplace error formatting', () => {
  it('normalizes non-Error install failures', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw { code: 'marketplace_unavailable' };
    }) as typeof globalThis.fetch;

    try {
      const result = await new SkillMarketplace().install(
        'owner/repo/example-skill',
        new MemoryStorage(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
      expect(result.error).not.toContain('[object Object]');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
