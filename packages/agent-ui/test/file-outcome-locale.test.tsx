import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from '@svton/ui';
import { describe, expect, it, vi } from 'vitest';
import { FileOutcomeItemView } from '../src/components/timeline/FileOutcomeItemView';
import type { FileOutcomeItemView as FileItem } from '../src/components/timeline/timeline.types';

const web = { openTerminal: false, openPath: false } as const;
const desktop = { openTerminal: false, openPath: true } as const;

describe('file outcome locale boundary', () => {
  it('localizes aggregate chrome while preserving IDs, paths, diffs, and disclosure state', () => {
    const item = aggregate();
    const { rerender } = render(view('en', item));
    const card = screen.getByTestId('timeline-file-outcome');
    expect(card).toHaveTextContent('3 file changes Completed');
    expect(card).toHaveTextContent('3 files affected');
    expect(card).toHaveTextContent('/动态/create.ts');
    expect(card).toHaveTextContent('/动态/modify.ts');
    expect(card).toHaveTextContent('/动态/delete.ts');
    expect(card).toHaveAttribute('data-timeline-id', 'timeline:file:turn:turn');
    expect(card).toHaveAttribute('data-source-call-ids', 'create modify delete');
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByTestId('file-outcome-details')).not.toHaveAttribute('hidden');
    expect(screen.getByTestId('file-outcome-details')).toHaveTextContent('diff-动态');
    rerender(view('zh', item));
    expect(card).toHaveTextContent('3 个文件变更：已完成');
    expect(card).toHaveTextContent('影响 3 个文件');
    expect(card).toHaveTextContent('新建');
    expect(card).toHaveTextContent('修改');
    expect(card).toHaveTextContent('删除');
    expect(screen.getByRole('button', { name: '隐藏详情' })).toHaveAttribute('aria-expanded', 'true');
    expect(card).toHaveAttribute('data-source-call-ids', 'create modify delete');
  });

  it('localizes Web capability feedback and never dispatches disabled open', () => {
    const onIntent = vi.fn();
    render(view('zh', single(), onIntent, web));
    const open = screen.getByRole('button', { name: '打开路径' });
    expect(open).toBeDisabled();
    expect(open).toHaveAttribute('title', '当前客户端无法打开路径');
    expect(screen.getByRole('status')).toHaveTextContent('当前客户端无法打开');
    fireEvent.click(open);
    expect(onIntent).not.toHaveBeenCalled();
  });

  it('uses localized generic fallback but preserves explicit host messages', async () => {
    const unavailable = vi.fn().mockResolvedValue({ status: 'unavailable' });
    const { rerender } = render(view('zh', single(), unavailable, desktop));
    fireEvent.click(screen.getByRole('button', { name: '复制路径' }));
    expect(await screen.findByRole('status')).toHaveTextContent('操作不可用');

    const explicit = vi.fn().mockResolvedValue({
      status: 'unavailable', message: 'host-动态-byte',
    });
    rerender(view('en', single(), explicit, desktop));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Path' }));
    expect(await screen.findByRole('status')).toHaveTextContent('host-动态-byte');
    rerender(view('zh', single(), explicit, desktop));
    expect(screen.getByRole('status')).toHaveTextContent('host-动态-byte');
  });

  it('dispatches exact path, diff, and open payloads', () => {
    const onIntent = vi.fn().mockReturnValue({ status: 'handled' });
    render(view('zh', single(), onIntent, desktop));
    fireEvent.click(screen.getByRole('button', { name: '复制路径' }));
    fireEvent.click(screen.getByRole('button', { name: '复制差异' }));
    fireEvent.click(screen.getByRole('button', { name: '打开路径' }));
    expect(onIntent).toHaveBeenNthCalledWith(1, {
      type: 'copy', target: 'path', value: '/动态/modify.ts',
    });
    expect(onIntent).toHaveBeenNthCalledWith(2, {
      type: 'copy', target: 'diff', value: '+diff-动态',
    });
    expect(onIntent).toHaveBeenNthCalledWith(3, {
      type: 'open', target: 'path', value: '/动态/modify.ts',
    });
  });
});

function view(
  locale: 'en' | 'zh',
  item: FileItem,
  onIntent?: ReturnType<typeof vi.fn>,
  capabilities = desktop,
) {
  return <LocaleProvider locale={locale}><FileOutcomeItemView
    item={item} capabilities={capabilities} onIntent={onIntent}
  /></LocaleProvider>;
}

function single(): FileItem {
  return {
    id: 'timeline:file:call:modify', sessionId: 'session', turnId: 'turn',
    kind: 'fileOutcome', scope: 'file', sourceCallIds: ['modify'], lane: 'outcome',
    status: 'completed', title: 'STALE', summary: 'STALE', revision: 0,
    changes: [{ sourceCallId: 'modify', path: '/动态/modify.ts', changeType: 'modify',
      status: 'completed', diff: '+diff-动态' }],
  };
}

function aggregate(): FileItem {
  const item = single();
  return {
    ...item, id: 'timeline:file:turn:turn', scope: 'turn',
    sourceCallIds: ['create', 'modify', 'delete'], detail: 'detail-动态',
    changes: [
      { sourceCallId: 'create', path: '/动态/create.ts', changeType: 'create', status: 'completed', diff: '+diff-动态' },
      item.changes[0]!,
      { sourceCallId: 'delete', path: '/动态/delete.ts', changeType: 'delete', status: 'completed', diff: '-diff-动态' },
    ],
  };
}
