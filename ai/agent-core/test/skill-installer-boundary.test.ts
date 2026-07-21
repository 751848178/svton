import { describe, expect, it, vi } from 'vitest';
import { SkillInstaller } from '../src/skill/installer';
import type { SkillDefinition, SkillInstallRecord } from '../src/skill/types';
import { MemoryStorage } from './helpers';

describe('SkillInstaller ownership boundaries', () => {
  it('keeps returned installed skills from mutating storage records', async () => {
    const storage = new MemoryStorage();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () =>
        [
          '---',
          'name: boundary-skill',
          'description: Boundary skill',
          'version: 1.0.0',
          '---',
          '',
          'Use the boundary.',
        ].join('\n'),
    })) as any;

    try {
      const result = await new SkillInstaller(storage).installFromUrl(
        'https://example.test/SKILL.md',
      );

      expect(result.success).toBe(true);
      expect(result.skill).toBeDefined();

      result.skill!.description = 'Mutated by caller';
      (result.skill!.source as { type: 'url'; url: string }).url =
        'https://evil.test/SKILL.md';

      const saved = await storage.get<SkillDefinition>(
        'agent:skill-installed:boundary-skill',
      );
      const record = await storage.get<SkillInstallRecord>(
        'agent:skill-registry:boundary-skill',
      );

      expect(saved?.description).toBe('Boundary skill');
      expect(saved?.source).toEqual({
        type: 'url',
        url: 'https://example.test/SKILL.md',
      });
      expect(record?.source).toEqual({
        type: 'url',
        url: 'https://example.test/SKILL.md',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('keeps listInstalled results from mutating registry storage', async () => {
    const storage = new MemoryStorage();
    await storage.set<SkillInstallRecord>('agent:skill-registry:boundary-skill', {
      name: 'boundary-skill',
      source: { type: 'local', path: '/skills/boundary' },
      installedAt: 1000,
      version: '1.0.0',
    });

    const records = await new SkillInstaller(storage).listInstalled();
    records[0].installedAt = 9999;
    records[0].version = 'mutated';
    (records[0].source as { type: 'local'; path: string }).path = '/skills/evil';

    const saved = await storage.get<SkillInstallRecord>(
      'agent:skill-registry:boundary-skill',
    );

    expect(saved).toEqual({
      name: 'boundary-skill',
      source: { type: 'local', path: '/skills/boundary' },
      installedAt: 1000,
      version: '1.0.0',
    });
  });
});
