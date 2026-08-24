import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleasePolicyTab } from './release-policy-tab';
import type { ReleasePolicyResponse } from '../../types/release-policy.types';

const mocks = vi.hoisted(() => ({
  hook: {
    policy: null as ReleasePolicyResponse | null,
    loading: false,
    saving: false,
    error: '',
    saveStandard: vi.fn(),
  },
  locale: 'zh',
}));

vi.mock('next-intl', () => ({
  useLocale: () => mocks.locale,
  useTranslations: () => (key: string) => key,
}));
vi.mock('@svton/ui', () => ({
  Card: ({
    title,
    extra,
    children,
  }: {
    title?: React.ReactNode;
    extra?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      {title}
      {extra}
      {children}
    </div>
  ),
}));
vi.mock('../../hooks/use-release-policy', () => ({
  useReleasePolicy: () => mocks.hook,
}));

describe('ReleasePolicyTab Demo-aligned policy page (AC-POLICY-001..010)', () => {
  beforeEach(() => {
    mocks.hook.loading = false;
    mocks.hook.saving = false;
    mocks.hook.error = '';
    mocks.hook.saveStandard.mockReset();
    mocks.hook.policy = revisionFixture();
  });

  it('renders the effective badge, snapshotHash, facts, standard card, gates table, callout and target rules', () => {
    const html = renderToStaticMarkup(<ReleasePolicyTab projectId="project-1" />);

    expect(html).toContain('policy-r3 · releasePolicyEffectiveBadge');
    expect(html).toContain('releasePolicyEnabledBy');
    expect(html).toContain('releasePolicySnapshotHash');
    expect(html).toContain('a'.repeat(64));
    for (const key of [
      'releasePolicyFactReleaseOrder',
      'releasePolicyFactArtifactPolicy',
      'releasePolicyFactProductionProtection',
      'releasePolicyFactConcurrency',
      'releasePolicyStandardCardDescription',
    ]) {
      expect(html).toContain(key);
    }
    for (const key of [
      'releasePolicyGateStagingVerified',
      'releasePolicyGateConfigReady',
      'releasePolicyGateHumanApproval',
      'releasePolicyGatePostDeployVerified',
    ]) {
      expect(html).toContain(key);
    }
    expect(html).toContain('releasePolicyGateEnabled');
    expect(html).toContain('releasePolicyGateTableGate');
    expect(html).toContain('releasePolicyGateTableState');
    expect(html).toContain('releasePolicyCallout');
    expect(html).toContain('releasePolicyTargetRulesTitle');
    expect(html).toContain('releasePolicyTargetRulesUnavailable');
    expect(html).toContain('releasePolicyTargetRulesEnforced');
  });

  it('renders the four capability cards with localized reasons and missing capabilities', () => {
    const html = renderToStaticMarkup(<ReleasePolicyTab projectId="project-1" />);

    expect(html).toContain('releasePolicyStrategyStandard');
    expect(html).toContain('releasePolicyStrategyCanary');
    expect(html).toContain('releasePolicyStrategyBlueGreen');
    expect(html).toContain('releasePolicyStrategyAutomaticTraffic');
    expect(html).toContain('releasePolicyAvailable');
    expect(html).toContain('releasePolicyUnavailable');
    expect(html).toContain('releasePolicyMissing');
    expect(html).toContain('real_traffic_provider');
    expect(html).toContain('candidate_and_stable_workloads');
  });

  it('keeps advanced strategies read-only: no selector or per-card action exists', () => {
    const html = renderToStaticMarkup(<ReleasePolicyTab projectId="project-1" />);
    expect(html).not.toContain('<select');
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain('type="checkbox"');
    const buttons = html.match(/<button/g);
    expect(buttons).toBeNull();
    expect(html).not.toContain('releasePolicySaveStandard');
  });

  it('shows the system default badge for a synthetic policy with a system creator', () => {
    mocks.hook.policy = {
      ...revisionFixture(),
      current: {
        id: null,
        revision: 0,
        strategy: 'standard',
        requireProductionApproval: true,
        snapshotHash: 'default-standard-policy-v1',
        synthetic: true,
      },
    };
    const html = renderToStaticMarkup(<ReleasePolicyTab projectId="project-1" />);
    expect(html).toContain('releasePolicySynthetic · releasePolicyEffectiveBadge');
    expect(html).toContain('releasePolicyEnabledBy');
    expect(html).toContain('default-standard-policy-v1');
    expect(html).not.toContain('policy-r3');
  });

  it('keeps editing unavailable and surfaces a policy loading error', () => {
    mocks.hook.saving = true;
    const savingHtml = renderToStaticMarkup(<ReleasePolicyTab projectId="project-1" />);
    expect(savingHtml).not.toContain('releasePolicySaving');
    expect(savingHtml).not.toContain('releasePolicySaveStandard');

    mocks.hook.saving = false;
    mocks.hook.error = '发布策略已更新，请刷新后重试';
    const errorHtml = renderToStaticMarkup(<ReleasePolicyTab projectId="project-1" />);
    expect(errorHtml).toContain('发布策略已更新，请刷新后重试');
  });

  it('renders the english reason copy in en locale', () => {
    mocks.locale = 'en';
    const html = renderToStaticMarkup(<ReleasePolicyTab projectId="project-1" />);
    expect(html).toContain('Canary requires real traffic providers');
    expect(html).not.toContain('金丝雀缺少真实流量');
  });
});

function revisionFixture(): ReleasePolicyResponse {
  return {
    current: {
      id: 'rev-3',
      revision: 3,
      strategy: 'standard',
      requireProductionApproval: true,
      snapshotHash: 'a'.repeat(64),
      createdAt: '2026-08-07T00:00:00.000Z',
      createdBy: { id: 'u1', name: 'Release Reviewer', email: 'reviewer@example.com' },
    },
    capabilities: [
      {
        strategy: 'standard',
        executable: true,
        reasonCode: 'standard_release_available',
        reason: { zh: '标准发布使用已冻结制品链路', en: 'Standard release uses the frozen chain' },
        missingCapabilities: [],
      },
      {
        strategy: 'canary',
        executable: false,
        reasonCode: 'release_strategy_capabilities_unavailable',
        reason: { zh: '金丝雀缺少真实流量', en: 'Canary requires real traffic providers' },
        missingCapabilities: ['real_traffic_provider', 'candidate_and_stable_workloads'],
      },
      {
        strategy: 'blue_green',
        executable: false,
        reasonCode: 'release_strategy_capabilities_unavailable',
        reason: { zh: '蓝绿缺少双工作负载', en: 'Blue-green requires dual workloads' },
        missingCapabilities: ['real_traffic_provider'],
      },
      {
        strategy: 'automatic_traffic',
        executable: false,
        reasonCode: 'release_strategy_capabilities_unavailable',
        reason: { zh: '自动放量缺少真实流量', en: 'Automatic traffic ramp requires real traffic' },
        missingCapabilities: ['metric_analysis_provider'],
      },
    ],
  };
}
