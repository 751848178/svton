// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseProductionPromotionManualGate } from './release-production-promotion-manual-gate';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@svton/ui', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Select: (props: Record<string, unknown>) => <select {...(props as object)}>{(props as { children?: React.ReactNode }).children}</select>,
  Textarea: (props: Record<string, unknown>) => <textarea {...props} />,
  Button: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    <button disabled={disabled} onClick={onClick}>{children}</button>,
  Modal: () => null,
}));

describe('ReleaseProductionPromotionManualGate', () => {
  let root: Root;
  let container: HTMLDivElement;
  const onChanged = vi.fn();

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.apiRequest.mockReset().mockResolvedValue({ id: 'approval-1' });
    onChanged.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => act(() => root.unmount()));

  it('confirms the exact P03 evaluation for a later executor retry', async () => {
    await act(async () => root.render(
      <ReleaseProductionPromotionManualGate
        projectId="project-1"
        releaseOrderId="order-1"
        blocker={{
          commandId: 'command-1', errorCode: 'RELEASE_GATE_BLOCKED',
          errorMessage: 'blocked', checkpoint: 'production_promote_pre_route',
          decisionId: 'decision-1', manualChecks: [{
            gateId: 'P03', evaluationId: 'evaluation-1', status: 'manual',
            reasonCode: 'critical_business_validation_required',
            reason: { zh: '需要独立业务验证', en: 'Independent validation required' },
          }],
        }}
        onChanged={onChanged}
      />,
    ));
    expect(container.textContent).toContain('需要独立业务验证');
    const textarea = container.querySelector('textarea')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )!.set!;
      setter.call(textarea, '由独立验证人确认候选');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => container.querySelector('button')!.click());

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'POST:/projects/project-1/delivery/releases/order-1/gates/P03/evaluations/evaluation-1/confirm',
      { reason: '由独立验证人确认候选' },
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
