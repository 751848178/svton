import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseGateCatalog, ReleaseGateCheck } from '../../types/release-gate.types';
import { ReleasePreflightEvidenceDrawer } from './release-preflight-evidence-drawer';

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@svton/ui', () => ({
  Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <aside>{children}</aside> : null,
}));
vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('../release-gate-manual-confirmation', () => ({
  ReleaseGateManualConfirmation: () => <div>real-manual-boundary</div>,
}));

describe('ReleasePreflightEvidenceDrawer', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
  });

  it('renders persisted audit fields from the current decision check', () => {
    const html = render(false);

    expect(html).toContain('evaluation-B01');
    expect(html).toContain('input-B01');
    expect(html).toContain('definition-v1');
    expect(html).toContain('catalog-v13 · capability-v15');
    expect(html).toContain('evidence-B01');
    expect(html).not.toContain('real-manual-boundary');
  });

  it('shows the server-backed manual confirmation only for a manual disposition', () => {
    expect(render(true)).toContain('real-manual-boundary');
  });
});

function render(manual: boolean) {
  const check = fixtureCheck(manual);
  return renderToStaticMarkup(
    <ReleasePreflightEvidenceDrawer
      catalog={
        {
          catalogVersion: 'catalog-v13',
          capabilityVersion: 'capability-v15',
        } as ReleaseGateCatalog
      }
      row={{ check, impact: manual ? 'manual' : 'blocker' }}
      confirmingGateId=""
      confirmationError=""
      onConfirmManual={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

function fixtureCheck(manual: boolean): ReleaseGateCheck {
  return {
    id: 'B01',
    phase: 'build',
    ordinal: 1,
    title: { zh: '检查 B01', en: 'Check B01' },
    dispositions: manual ? ['manual'] : ['blocking'],
    capabilityId: 'M03',
    delivery: 'mvp',
    status: manual ? 'manual' : 'unavailable',
    providerKey: 'provider-v1',
    reasonCode: 'TEST_REASON',
    reason: { zh: '真实原因', en: 'Real reason' },
    evidenceRef: 'evidence-B01',
    checkedAt: '2026-08-28T00:00:00.000Z',
    expiresAt: '2026-08-29T00:00:00.000Z',
    fresh: true,
    evaluationId: 'evaluation-B01',
    evaluationInputHash: 'input-B01',
    definitionVersion: 'definition-v1',
    persistedStatus: manual ? 'needs_human' : 'unavailable',
    persistedAt: '2026-08-28T00:00:01.000Z',
    waiver: null,
    waiverExpiresAt: null,
  };
}
