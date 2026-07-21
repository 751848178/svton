import { describe, expect, it, vi } from 'vitest';
import { SkillInstaller } from '../src/skill/installer';
import { MemoryStorage, createMockPlatform } from './helpers';

describe('SkillInstaller error formatting', () => {
  it('normalizes non-Error installFromUrl failures', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw { code: 'fetch_down' };
    }) as any;

    try {
      const result = await new SkillInstaller(new MemoryStorage()).installFromUrl(
        'https://example.com/SKILL.md',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
      expect(result.error).not.toContain('[object Object]');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('normalizes non-Error installFromLocalDir filesystem failures', async () => {
    const platform = createMockPlatform({
      fs: {
        exists: async () => true,
        readFile: async () => {
          throw { code: 'read_down' };
        },
      },
    });

    const result = await new SkillInstaller(new MemoryStorage(), platform).installFromLocalDir(
      '/skills/example',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
    expect(result.error).not.toContain('[object Object]');
  });
});
