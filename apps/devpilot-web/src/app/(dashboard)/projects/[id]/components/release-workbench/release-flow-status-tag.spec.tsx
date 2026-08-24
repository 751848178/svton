// @vitest-environment jsdom

/**
 * PX-13：FlowStatusTag 必须同时携带 border-transparent（隐藏边框）与 h-6
 * （24px 固定总高，含透明边框盒），保证灰徽章（证据不可用）与绿/橙徽章
 * （构建成功/待完成）同高同形态，不再出现 26px vs 24px 双形态。
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FlowStatusTag } from './release-flow-status-tag';

vi.mock('@/components/ui', () => ({
  StatusTag: ({
    className,
    label,
  }: {
    className?: string;
    label?: React.ReactNode;
  }) => (
    <span
      data-testid="flow-status-tag"
      className={className}
    >
      {label}
    </span>
  ),
}));

describe('FlowStatusTag (PX-13 unified badge shape)', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  it.each(['构建成功', '证据不可用', '待完成（不阻断）'])(
    'renders "%s" with border-transparent and fixed h-6 height',
    async (label) => {
      const container = document.createElement('div');
      const root = createRoot(container);
      await act(async () =>
        root.render(<FlowStatusTag status="neutral" label={label} />),
      );
      const tag = container.querySelector('[data-testid="flow-status-tag"]');
      expect(tag).not.toBeNull();
      expect(tag?.className).toContain('border-transparent');
      expect(tag?.className).toContain('h-6');
      await act(async () => root.unmount());
    },
  );
});
