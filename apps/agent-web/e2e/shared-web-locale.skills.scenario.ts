import { expect, type Page } from '@playwright/test';
import {
  captureEvidence,
  type BrowserDiagnostics,
  type EvidenceAssertions,
  type EvidenceRecord,
} from './shared-web-locale.evidence';

export const publicSkillAssetPaths = [
  '/skills/svton/SKILL.md',
  '/skills/svton-api-client/SKILL.md',
  '/skills/svton-service/SKILL.md',
  '/skills/engineering-craft-principles/SKILL.md',
  '/skills/universal-craft-principles/SKILL.md',
  '/skills/verify-before-done/SKILL.md',
  '/skills/plan-before-code/SKILL.md',
  '/skills/codegraph-cli-navigation/SKILL.md',
] as const;

export const expectedSkillNames = [
  'svton',
  'svton-api-client',
  'svton-service',
  'engineering-craft-principles',
  'universal-craft-principles',
  'verify-before-done',
  'plan-before-code',
  'codegraph-cli-navigation',
  'e2e-timeline-context',
  'code-review',
] as const;

const representativeDescriptions = {
  svton: 'Provides usage guidelines and best practices for SVTON framework development across frontend (React/Taro) and backend (NestJS). Use when working with SVTON monorepo projects, implementing new features, or using @svton/* packages.',
  'e2e-timeline-context': 'Deterministic installed-skill fixture for timeline reload E2E.',
  'code-review': 'Code review against branches, commits, or uncommitted changes',
} as const;

export interface SkillsAuxiliaryLabels {
  kind: 'skills';
  id: 'skills';
  button: string;
  heading: string;
  manage: string;
  empty: string;
  userScope: string;
  systemScope: string;
}

export interface SkillAssetResponse {
  path: string;
  status: number;
  url: string;
}

export interface SkillAssetObservation {
  responses: SkillAssetResponse[];
}

export function installSkillAssetObservation(page: Page): SkillAssetObservation {
  const observation: SkillAssetObservation = { responses: [] };
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (!publicSkillAssetPaths.includes(url.pathname as typeof publicSkillAssetPaths[number])) return;
    observation.responses.push({ path: url.pathname, status: response.status(), url: response.url() });
  });
  return observation;
}

export async function capturePopulatedSkillsScenario(
  page: Page,
  locale: 'en' | 'zh',
  labels: SkillsAuxiliaryLabels,
  diagnostics: BrowserDiagnostics,
  assets: SkillAssetObservation,
): Promise<EvidenceRecord> {
  const region = page.getByRole('region', { name: labels.heading });
  await expect(region).toBeVisible();
  await expect(region.getByRole('heading', { name: labels.heading, exact: true })).toBeVisible();
  await expect(region.getByRole('link', { name: labels.manage, exact: true })).toHaveAttribute('href', '/settings');
  await expect(region.getByText(labels.empty, { exact: true })).toHaveCount(0);
  const cards = region.getByTestId('skill-card');
  await expect(cards).toHaveCount(expectedSkillNames.length);
  const names = await cards.evaluateAll((elements) => elements.map((element) => (
    element.getAttribute('data-skill-name')
  )));
  expect(names).toEqual(expectedSkillNames);
  expect(new Set(names).size).toBe(expectedSkillNames.length);
  for (const name of expectedSkillNames.slice(0, -1)) {
    const card = region.locator(`[data-skill-name="${name}"]`);
    await expect(card).toHaveAttribute('data-skill-scope', 'user');
    await expect(card).toContainText(labels.userScope);
  }
  const system = region.locator('[data-skill-name="code-review"]');
  await expect(system).toHaveAttribute('data-skill-scope', 'system');
  await expect(system).toContainText(labels.systemScope);
  for (const [name, description] of Object.entries(representativeDescriptions)) {
    await expect(region.locator(`[data-skill-name="${name}"]`)).toContainText(description);
  }
  await expect.poll(() => new Set(assets.responses.map((response) => response.path)).size)
    .toBe(publicSkillAssetPaths.length);
  expect(assets.responses.every((response) => response.status === 200)).toBe(true);
  const firstResponses = publicSkillAssetPaths.map((path) => {
    const response = assets.responses.find((candidate) => candidate.path === path);
    expect(response, `first-navigation response for ${path}`).toBeDefined();
    return response!;
  });
  const responseCountByPath = Object.fromEntries(publicSkillAssetPaths.map((path) => [
    path, assets.responses.filter((response) => response.path === path).length,
  ]));
  const assertions: EvidenceAssertions = {
    dom: ['populated product Skills inventory in source order',
      'ten unique skills; empty state absent',
      'eight unique first-navigation public asset paths returned HTTP 200',
      'public and installed scopes user; code-review scope system', 'no horizontal overflow'],
    focus: [], keyboard: [], status: [], live: [], error: [],
    ax: [`heading "${labels.heading}"`, `link "${labels.manage}"`,
      'svton', representativeDescriptions.svton, 'e2e-timeline-context', 'code-review'],
  };
  return captureEvidence(page, locale, 'aux-skills', assertions, diagnostics, {
    skillInventory: names,
    scopeContract: { publicAndInstalled: 'user', codeReview: 'system' },
    publicAssetFirstResponses: firstResponses.map((response) => ({ ...response })),
    publicAssetResponseEvents: assets.responses.map((response) => ({ ...response })),
    publicAssetResponseCountByPath: responseCountByPath,
  });
}
