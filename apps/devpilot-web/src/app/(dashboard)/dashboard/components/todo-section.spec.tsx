import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TodoSection } from './todo-section';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('TodoSection request-state semantics', () => {
  it('renders all-clear only when every source is available and counts are zero', () => {
    const html = render({ incomplete: false });

    expect(html).toContain('todoAllClear');
    expect(html).not.toContain('todoIncomplete');
  });

  it('renders an incomplete warning instead of all-clear during partial failure', () => {
    const html = render({ incomplete: true });

    expect(html).toContain('data-dashboard-todo-state="incomplete"');
    expect(html).toContain('todoIncomplete');
    expect(html).not.toContain('todoAllClear');
  });

  it('keeps known actionable items visible during partial failure', () => {
    const html = render({ incomplete: true, pendingApprovals: 2 });

    expect(html).toContain('todoPendingApprovals');
    expect(html).toContain('>2<');
    expect(html).not.toContain('todoIncomplete');
    expect(html).not.toContain('todoAllClear');
  });
});

function render(overrides: Partial<React.ComponentProps<typeof TodoSection>>) {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  return renderToStaticMarkup(
    <TodoSection
      pendingApprovals={0}
      failedDeployments={0}
      firingAlerts={0}
      incomplete={false}
      {...overrides}
    />,
  );
}
