// @vitest-environment jsdom

/** SET-16/SET-17 回归：无变更禁用保存并提示；修订计数可展开修订列表。 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentSettingsRevisionBar } from './environment-settings-revision-bar';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/lib/format-date', () => ({ formatDateTimeMinute: (v: string) => v }));
vi.mock('@svton/ui', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}));
vi.mock('@/components/ui', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

function revision(overrides: Partial<EnvironmentConfigRevision> = {}): EnvironmentConfigRevision {
  return {
    id: 'rev-1',
    revision: 1,
    snapshotHash: 'a'.repeat(64),
    plainVariables: {},
    secretReferences: [],
    resourceReferences: [],
    routeSnapshot: {},
    policyReferences: [],
    source: 'project_intake',
    createdAt: '2026-08-01T00:00:00Z',
    current: true,
    changeSummary: '初始化配置',
    ...overrides,
  } as EnvironmentConfigRevision;
}

describe('EnvironmentSettingsRevisionBar (SET-16/SET-17)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSave: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    onSave = vi.fn();
  });
  afterEach(async () => act(async () => root.unmount()));

  function renderBar(overrides: Record<string, unknown> = {}) {
    return act(async () => {
      root.render(
        <EnvironmentSettingsRevisionBar
          inputId="summary"
          summary=""
          revisionCount={1}
          revisions={[revision()]}
          saving={false}
          loading={false}
          invalid={false}
          noChanges={false}
          onSummaryChange={() => undefined}
          onSave={onSave}
          {...overrides}
        />,
      );
    });
  }

  it('SET-16: disables save with an explicit no-change hint when the draft is clean', async () => {
    await renderBar({ noChanges: true });
    const save = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('configCreateRevision'),
    )!;
    expect(save.disabled).toBe(true);
    expect(save.getAttribute('title')).toContain('configRevisionNoChanges');
    expect(container.textContent).toContain('configRevisionNoChanges');
  });

  it('SET-16: keeps save enabled when there are pending changes', async () => {
    await renderBar({ noChanges: false });
    const save = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('configCreateRevision'),
    )!;
    expect(save.disabled).toBe(false);
    expect(container.textContent).not.toContain('configRevisionNoChanges');
  });

  it('SET-17: the revision count toggles a revision list with summary and current flag', async () => {
    await renderBar({
      revisions: [revision(), revision({ id: 'rev-2', revision: 2, current: false, changeSummary: null })],
    });
    expect(container.querySelector('ul')).toBeNull();
    const countButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('configRevisionHistoryCount'),
    )!;
    await act(async () => countButton.click());
    const list = container.querySelector('ul')!;
    expect(list).not.toBeNull();
    expect(list.textContent).toContain('R1');
    expect(list.textContent).toContain('configRevisionCurrent');
    expect(list.textContent).toContain('初始化配置');
    expect(list.textContent).toContain('configRevisionNoSummary');
    await act(async () => countButton.click());
    expect(container.querySelector('ul')).toBeNull();
  });
});
