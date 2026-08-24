// @vitest-environment jsdom

/** INFO-2 回归：证据列表超过 20 条时必须声明「仅展示前 20 条」并提供展开全部。 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryRunPanel } from './repository-run-panel';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  LoadingState: () => <div>loading</div>,
  EmptyState: () => <div>empty</div>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
}));

const EVIDENCE = Array.from({ length: 25 }, (_, i) => ({ file: `file-${i}.ts`, detail: 'changed' }));

const RUN = {
  id: 'run-1',
  status: 'succeeded',
  branch: 'master',
  commitSha: 'abcdef1234567890',
  stages: [{ name: 'inventory', status: 'succeeded', evidence: EVIDENCE }],
};

const analysis = {
  loading: false,
  error: '',
  projectId: 'p1',
  runs: [RUN],
  selectedRun: RUN,
} as never;

describe('RepositoryRunPanel evidence paging (INFO-2)', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });
  afterEach(async () => act(async () => root.unmount()));

  it('labels the first page and expands all evidence on demand', async () => {
    await act(async () => {
      root.render(<RepositoryRunPanel analysis={analysis} onSelectRun={() => undefined} />);
    });
    const summary = [...container.querySelectorAll('summary')].find((s) =>
      s.textContent?.includes('25 条证据'),
    )!;
    expect(summary).not.toBeNull();
    // 默认仅 20 条 + 显式声明
    expect(container.querySelectorAll('li.font-mono').length
      + container.querySelectorAll('li.break-all').length).toBeGreaterThanOrEqual(20);
    expect(container.textContent).toContain('仅展示前 20 条');

    const expand = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('展开全部 25 条'),
    )!;
    await act(async () => {
      expand.click();
    });
    expect(container.querySelectorAll('li').length).toBeGreaterThanOrEqual(25);
    expect(container.textContent).toContain('收起');
  });
});
