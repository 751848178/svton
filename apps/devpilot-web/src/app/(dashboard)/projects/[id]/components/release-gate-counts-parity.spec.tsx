// @vitest-environment jsdom

/**
 * PX-1 门禁计数口径回归：预警条（决策卡）与步骤 01 证据区区头/组行
 * 必须取同一「当前执行阶段决策」，不允许出现 banner 3 vs 区头 5 的双口径。
 * fixture 还原 2026-08-24 真实数据形态：staging 决策阻断 3（B01/B03/B06，
 * 分属 M03/M03/M04），build 决策阻断 5（C02/C03/C05/C06/C08）。
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ReleaseGateCatalog,
  ReleaseGateCheck,
} from '../types/release-gate.types';
import { buildReleaseGateSummary } from './release-gate-summary.model';
import { ReleaseStepPreflightPanel } from './release-workbench/release-step-preflight-panel';
import { ReleaseWorkbenchDecisionCard } from './release-workbench/release-workbench-decision-card';
import {
  buildReleaseWorkbenchGateSummary,
  releaseWorkbenchDecisionStep,
} from './release-workbench/release-workbench-summary.model';
import type { ReleaseOrderDetail } from '../types/release-order.types';

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@svton/ui', () => ({ LoadingState: () => <div>loading</div> }));
vi.mock('@/components/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  LinkButton: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  StatusTag: ({ label }: { label?: string }) => <span>{label}</span>,
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('PX-1 gate count single source (stage decision)', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('summary counts and per-group breakdown both follow the staging decision', () => {
    const summary = buildReleaseGateSummary(realCatalog(), 'staging');
    expect(summary.blockingCount).toBe(3);
    const groupBlockedSum = summary.previews.reduce(
      (total, preview) => total + preview.blockingCount,
      0,
    );
    expect(groupBlockedSum).toBe(3);
    // 组行聚合该能力组全部 MVP 检查（不再按决策 phase 过滤）。
    expect(summary.previews.find((preview) => preview.key === 'baseline')?.checkCount).toBe(5);
  });

  it('banner gate and preflight panel render the same blocked count', async () => {
    const catalog = realCatalog();
    const detail = realDetail();
    const decisionStep = releaseWorkbenchDecisionStep(detail);
    expect(decisionStep).toBe('staging');
    const bannerGate = buildReleaseWorkbenchGateSummary({
      step: decisionStep,
      catalog,
      loading: false,
      error: '',
      locale: 'zh-CN',
    });
    expect(bannerGate.blockerCount).toBe(3);

    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <div>
          <ReleaseWorkbenchDecisionCard
            decisionStep={decisionStep}
            gate={bannerGate}
            onReviewGate={vi.fn()}
          />
          <ReleaseStepPreflightPanel
            detail={detail}
            gateCatalog={{
              catalog,
              loading: false,
              error: '',
              load: vi.fn(),
              confirmManual: vi.fn(),
              confirmingGateId: '',
              confirmationError: '',
            } as unknown as Parameters<typeof ReleaseStepPreflightPanel>[0]['gateCatalog']}
          />
        </div>,
      ),
    );
    const counts = container.querySelector('[data-testid="gate-summary-counts"]');
    expect(counts?.textContent).toContain('"blocked":3');
    expect(counts?.textContent).toContain('releaseStepStagingTitle');
    const banner = container.querySelector('[data-testid="release-decision-heading"]');
    expect(banner?.textContent).toContain('"blocked":3');
    // 双口径回归锚点：任何位置都不再出现 build 决策的「阻断 5」。
    expect(container.textContent).not.toContain('"blocked":5');
    // ROD-5：组描述不得再渲染 raw ISO 时间戳（本地 YYYY-MM-DD HH:mm 呈现）。
    expect(container.textContent).toContain('过期，必须重新检查');
    expect(container.textContent).not.toMatch(/2026-08-17T09:11/);
    await act(async () => root.unmount());
  });

  it('falls back to the unified empty label when a group has no checkedAt (PX-27)', async () => {
    const catalog = realCatalog();
    catalog.checks.forEach((item) => {
      item.checkedAt = null;
    });
    const detail = realDetail();
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ReleaseStepPreflightPanel
          detail={detail}
          gateCatalog={{
            catalog,
            loading: false,
            error: '',
            load: vi.fn(),
            confirmManual: vi.fn(),
            confirmingGateId: '',
            confirmationError: '',
          } as unknown as Parameters<typeof ReleaseStepPreflightPanel>[0]['gateCatalog']}
        />,
      ),
    );
    // 组行时间空值统一回退 releaseWorkbenchValueEmpty（暂无），不再渲染「检查于 -」。
    expect(container.textContent).toContain('"time":"releaseWorkbenchValueEmpty"');
    expect(container.textContent).not.toContain('"time":"-"');
    await act(async () => root.unmount());
  });
});

function realDetail() {
  return {
    lifecycle: { status: 'staging', phase: 'staging', failureKind: null },
    resumeStep: 'staging',
    preflight: {
      repository: { branch: 'master', ready: true },
      staging: { ready: true },
      production: { ready: true },
    },
  } as unknown as ReleaseOrderDetail;
}

function realCatalog(): ReleaseGateCatalog {
  const checks = [
    check('C01', 'commit', 'M01', 'checked'),
    check('C02', 'commit', 'M01', 'unavailable'),
    check('C03', 'commit', 'M01', 'unavailable'),
    check('C05', 'commit', 'M02', 'unchecked'),
    check('C06', 'commit', 'M02', 'unavailable'),
    check('C07', 'commit', 'M04', 'unavailable'),
    check('C08', 'commit', 'M03', 'unchecked'),
    check('C09', 'commit', 'M03', 'unavailable'),
    check('B01', 'build', 'M03', 'unavailable'),
    check('B02', 'build', 'M03', 'checked'),
    check('B03', 'build', 'M03', 'unavailable'),
    check('B06', 'build', 'M04', 'unavailable'),
  ];
  return {
    catalogVersion: 'v13.test',
    capabilityVersion: 'mvp15.test',
    releaseOrder: { id: 'order-1', releaseVersion: '0.0.1' },
    summary: {
      total: 12,
      phaseCounts: { commit: 8, build: 4, deploy: 0, promote: 0 },
      statusCounts: { checked: 3, unchecked: 2, blocked: 0, warning: 0, manual: 0, unavailable: 7 },
    },
    decisions: {
      build: {
        ...decision('build', 'commit', false),
        blockerGateIds: ['C02', 'C03', 'C05', 'C06', 'C08'],
      },
      staging: {
        ...decision('staging', 'build', false),
        blockerGateIds: ['B01', 'B03', 'B06'],
      },
      production: null,
    } as unknown as ReleaseGateCatalog['decisions'],
    targetReadiness: targetReadiness(),
    capabilities: [
      capability('M01'),
      capability('M02'),
      capability('M03'),
      capability('M04'),
    ],
    checks,
  };
}

function decision(
  stage: 'build' | 'staging' | 'production',
  phase: 'commit' | 'build' | 'deploy',
  allowed: boolean,
): ReleaseGateCatalog['decisions']['build'] {
  return {
    id: `decision-${stage}`,
    stage,
    phase,
    allowed,
    blockerGateIds: [] as string[],
    manualGateIds: [] as string[],
    confirmedManualGateIds: [] as string[],
    warningGateIds: [] as string[],
    deferredGateIds: [] as string[],
    evidenceOnlyGateIds: [] as string[],
    integrityErrors: [] as string[],
    inputHash: `input-${stage}`,
    decidedAt: '2026-08-24T04:58:58.000Z',
  };
}

function check(
  id: string,
  phase: 'commit' | 'build',
  capabilityId: string,
  status: ReleaseGateCheck['status'],
): ReleaseGateCheck {
  return {
    id,
    phase,
    ordinal: 1,
    title: { zh: id, en: id },
    dispositions: ['block'],
    capabilityId,
    delivery: 'mvp',
    status,
    providerKey: null,
    reasonCode: 'fixture',
    reason: {
      zh:
        status === 'unchecked'
          ? `证据已于 2026-08-17T09:11:21.126Z 过期，必须重新检查`
          : `原因 ${id}`,
      en: `reason ${id}`,
    },
    evidenceRef: null,
    checkedAt: '2026-08-17T09:11:21.126Z',
    expiresAt: '2026-08-17T09:11:21.126Z',
    fresh: false,
    evaluationId: `evaluation-${id}`,
    evaluationInputHash: `hash-${id}`,
    definitionVersion: 'v13.test:mvp15.test',
    persistedStatus: 'failed',
    persistedAt: '2026-08-10T09:11:21.126Z',
    waiver: null,
    waiverExpiresAt: null,
  };
}

function capability(id: string): ReleaseGateCatalog['capabilities'][number] {
  return {
    id,
    name: { zh: `能力 ${id}`, en: `Capability ${id}` },
    available: true,
    providerKey: null,
    reasonCode: 'fixture',
    reason: { zh: 'fixture', en: 'fixture' },
  };
}

function targetReadiness(): ReleaseGateCatalog['targetReadiness'] {
  return targetReadinessValue() as ReleaseGateCatalog['targetReadiness'];
}

function targetReadinessValue() {
  return {
    environmentId: 'staging-1',
    environmentKey: 'staging',
    expectedProviderKey: 'ssh-v1',
    bindingCount: 1,
    matchState: 'ready',
    reasonCode: 'TARGET_READY',
    remediation: null,
    currentTarget: null,
  };
}
