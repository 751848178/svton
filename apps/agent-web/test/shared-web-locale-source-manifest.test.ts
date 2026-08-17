import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sharedWebLocaleSourceFiles } from '../e2e/shared-web-locale.sources';
import {
  decisionManifest,
  readDecisionHashes,
  validateDecisionHashes,
} from '../e2e/shared-web-locale.decisions';

const registryAndRenderOwners = [
  'apps/agent-web/src/components/AgentChat.tsx',
  'apps/agent-web/src/components/AgentLayout.tsx',
  'apps/agent-web/src/components/WebAgentContent.tsx',
  'apps/agent-web/src/components/WebSkillsPanel.tsx',
  'apps/agent-web/src/lib/agent-setup.ts',
  'apps/agent-web/src/lib/e2e-timeline-skill.ts',
  'packages/agent-app/src/lib/create-agent-config.ts',
  'packages/agent-app/src/lib/agent-config-capabilities.service.ts',
  'ai/agent-core/src/skill/loader.ts',
  'ai/agent-core/src/skill/manager.ts',
  'ai/agent-core/src/skill/builtin/code-review.ts',
  'ai/agent-platform/src/browser.ts',
  'apps/agent-web/playwright.config.ts',
] as const;

const publicAssets = [
  'apps/agent-web/public/skills/svton/SKILL.md',
  'apps/agent-web/public/skills/svton-api-client/SKILL.md',
  'apps/agent-web/public/skills/svton-service/SKILL.md',
  'apps/agent-web/public/skills/engineering-craft-principles/SKILL.md',
  'apps/agent-web/public/skills/universal-craft-principles/SKILL.md',
  'apps/agent-web/public/skills/verify-before-done/SKILL.md',
  'apps/agent-web/public/skills/plan-before-code/SKILL.md',
  'apps/agent-web/public/skills/codegraph-cli-navigation/SKILL.md',
] as const;

describe('shared Web locale source manifest', () => {
  it('binds every Skills registry, discovery, rendering, and public asset owner', () => {
    for (const file of [...registryAndRenderOwners, ...publicAssets]) {
      expect(sharedWebLocaleSourceFiles, file).toContain(file);
    }
    expect(sharedWebLocaleSourceFiles.filter((file) => (
      file.startsWith('apps/agent-web/public/skills/')
    ))).toEqual(publicAssets);
  });

  it('binds the exact resolved workspace runtime entrypoints and focused proof', () => {
    for (const file of [
      'ai/agent-core/dist/index.mjs',
      'ai/agent-client/dist/index.mjs',
      'apps/agent-web/e2e/shared-web-locale.skills.scenario.ts',
      'apps/agent-web/test/agent-setup.test.ts',
      'apps/agent-web/test/web-auxiliary-panels.test.tsx',
      'apps/agent-web/test/shared-web-locale-source-manifest.test.ts',
    ]) expect(sharedWebLocaleSourceFiles, file).toContain(file);
  });

  it('contains only unique files that exist in the repository snapshot', () => {
    expect(new Set(sharedWebLocaleSourceFiles).size).toBe(sharedWebLocaleSourceFiles.length);
    const root = resolve(process.cwd(), '../..');
    expect(sharedWebLocaleSourceFiles.filter((file) => !existsSync(resolve(root, file)))).toEqual([]);
  });

  it('binds the UIINV-030 report and result as the populated Skills decision', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'svton-web-locale-decisions-'));
    try {
      const paths = {
        codeReview: join(fixtureRoot, 'code-review.md'),
        timeline: join(fixtureRoot, 'timeline.md'),
        skills: join(fixtureRoot, 'skills.md'),
        skillsResult: join(fixtureRoot, 'skills-result.json'),
      };
      for (const [name, path] of Object.entries(paths)) writeFileSync(path, name);
      const hashes = readDecisionHashes(paths);
      for (const hash of Object.values(hashes)) expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(validateDecisionHashes(hashes, hashes)).toEqual([]);
      const root = resolve(process.cwd(), '../..');
      const manifest = decisionManifest(hashes, hashes, root);
      expect(manifest.skillsEvidence.status).toBe('real_populated_inventory_selected');
      expect(manifest.skillsEvidence.expectedInventory).toHaveLength(10);
      expect(manifest.skillsEvidence.decisionReport.currentMatch).toBe(true);
      expect(manifest.skillsEvidence.decisionResult.currentMatch).toBe(true);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
