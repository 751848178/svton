import React from 'react';
import '@testing-library/jest-dom/vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SessionInfo,
  SessionActivityViewModel,
  SessionManagementController,
  SessionManagementViewModel,
  SessionSearchResult,
} from '@svton/agent-client';
import { DesktopSessionSearch } from '../src/components/DesktopSessionSearch';
import { LocaleProvider } from '@svton/ui';

describe('Desktop session search accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('uses the shared modal layer, traps focus, and restores the exact opener', async () => {
    const onClose = vi.fn();
    const app = document.createElement('main');
    const opener = document.createElement('button');
    opener.textContent = 'Search opener';
    app.appendChild(opener);
    document.body.appendChild(app);
    opener.focus();
    const view = renderSearch({ results: [result(session('a', 'Alpha'))], onClose });

    const dialog = await screen.findByRole('dialog', { name: '搜索对话' });
    const query = screen.getByRole('combobox', { name: '搜索对话标题' });
    await waitFor(() => expect(query).toHaveFocus());
    expect(query).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    expect(query).toHaveAttribute('aria-autocomplete', 'list');
    expect(query).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelectorAll('[data-svton-modal-layer]')).toHaveLength(1);
    expect((app as HTMLElement & { inert: boolean }).inert).toBe(true);

    const close = screen.getByRole('button', { name: 'Close' });
    screen.getByRole('checkbox').focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    view.rerender(component({ open: false, results: [result(session('a', 'Alpha'))] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(app).not.toHaveAttribute('inert');
  });

  it('keeps input focus and stable session identity across keyboard navigation and reorder', async () => {
    const onSelect = vi.fn();
    const initial = ['a', 'b', 'c'].map((id) => result(session(id, id.toUpperCase())));
    const view = renderSearch({ results: initial, onSelect });
    const query = await screen.findByRole('combobox');
    await waitFor(() => expect(selectedOption()).toHaveTextContent('A'));
    fireEvent.keyDown(query, { key: 'ArrowDown' });
    expect(selectedOption()).toHaveTextContent('B');
    fireEvent.keyDown(query, { key: 'End' });
    expect(selectedOption()).toHaveTextContent('C');
    fireEvent.keyDown(query, { key: 'Home' });
    expect(selectedOption()).toHaveTextContent('A');
    expect(query).toHaveFocus();
    const stableOptionId = selectedOption().id;

    view.rerender(component({ results: [initial[2], initial[0]], onSelect }));
    expect(selectedOption()).toHaveTextContent('A');
    expect(selectedOption()).toHaveAttribute('id', stableOptionId);
    view.rerender(component({ results: [initial[2]], onSelect }));
    await waitFor(() => expect(selectedOption()).toHaveTextContent('C'));
    expect(query.getAttribute('aria-activedescendant')).toBe(selectedOption().id);
    fireEvent.keyDown(query, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('resets selection identity when query or scope context changes', async () => {
    const active = [result(session('a', 'Alpha')), result(session('b', 'Beta'))];
    const view = renderSearch({ results: active });
    const query = await screen.findByRole('combobox');
    await waitFor(() => expect(selectedOption()).toHaveTextContent('Alpha'));
    fireEvent.keyDown(query, { key: 'ArrowDown' });
    expect(selectedOption()).toHaveTextContent('Beta');

    view.rerender(component({
      results: [result(session('c', 'Changed'))],
      search: searchModel({ query: 'changed' }),
    }));
    await waitFor(() => expect(selectedOption()).toHaveTextContent('Changed'));
    const archived = session('d', 'Archived context', 10);
    view.rerender(component({
      results: [result(archived)],
      search: searchModel({ query: 'changed', scope: 'archived' }),
      managementBySessionId: new Map([[archived.id, management(archived.id)]]),
    }));
    await waitFor(() => expect(selectedOption()).toHaveTextContent('Archived context'));
  });

  it('blocks stale result activation while loading and exposes one bounded status owner', async () => {
    const onSelect = vi.fn();
    const rows = [result(session('a', 'Alpha'))];
    const activityBySessionId = new Map<string, SessionActivityViewModel>([['a', {
      sessionId: 'a', phase: 'inProgress', isUnread: true, terminal: null,
      statusLabel: 'Running', statusDescription: 'Running',
    }]]);
    const view = renderSearch({ results: rows, onSelect, activityBySessionId });
    const query = await screen.findByRole('combobox');
    await waitFor(() => expect(selectedOption()).toBeInTheDocument());
    expect(screen.getAllByRole('status')).toHaveLength(1);
    view.rerender(component({
      results: rows,
      onSelect,
      activityBySessionId,
      search: searchModel({ searching: true }),
    }));
    expect(query).not.toHaveAttribute('aria-activedescendant');
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('正在搜索');
    expect(screen.getByRole('option')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(query, { key: 'Enter' });
    fireEvent.click(screen.getByRole('option'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps archived options discoverable and unarchives externally without opening', async () => {
    let release!: (value: { ok: boolean }) => void;
    const pending = new Promise<{ ok: boolean }>((resolve) => { release = resolve; });
    const actions = managementActions({ unarchive: vi.fn(() => pending) });
    const archived = session('archived', 'Archived', 10);
    const onSelect = vi.fn();
    renderSearch({
      results: [result(archived)],
      managementBySessionId: new Map([[archived.id, management(archived.id)]]),
      managementActions: actions,
      onSelect,
    });
    const query = await screen.findByRole('combobox');
    const option = await screen.findByRole('option', { name: /Archived/ });
    await waitFor(() => expect(option).toHaveAttribute('aria-selected', 'true'));
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(within(option).queryAllByRole('button')).toHaveLength(0);
    fireEvent.keyDown(query, { key: 'Enter' });
    fireEvent.click(option);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const action = screen.getByRole('button', { name: '取消归档“Archived”' });
    act(() => {
      action.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      action.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(action).toBeDisabled();
    expect(actions.unarchive).toHaveBeenCalledOnce();
    release({ ok: true });
    await waitFor(() => expect(action).not.toBeDisabled());
    expect(query).toHaveFocus();
  });

  it('uses one sanitized alert owner for unarchive and search retry failures', async () => {
    const unarchive = vi.fn(async () => ({ ok: false }));
    const actions = managementActions({ unarchive });
    const archived = session('archived', 'Archived', 10);
    const retry = vi.fn();
    const view = renderSearch({
      results: [result(archived)],
      managementBySessionId: new Map([[archived.id, management(archived.id)]]),
      managementActions: actions,
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: '取消归档“Archived”' }));
      await Promise.resolve();
    });
    const alert = await screen.findByRole('alert');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(alert).toHaveTextContent('操作暂时不可用');
    expect(alert).not.toHaveTextContent('storage secret');
    await act(async () => {
      fireEvent.click(within(alert).getByRole('button', { name: '重试' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(unarchive).toHaveBeenCalledTimes(2);

    view.rerender(component({
      results: [],
      search: searchModel({ error: 'unavailable', retry }),
    }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('selects and opens active options by pointer without nested controls', async () => {
    const onSelect = vi.fn();
    renderSearch({ results: [result(session('a', 'Alpha'))], onSelect });
    const option = await screen.findByRole('option', { name: /Alpha/ });
    expect(within(option).queryAllByRole('button')).toHaveLength(0);
    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('keeps an accessible status owner without duplicating the visible empty state', async () => {
    renderSearch({ results: [] });
    expect(await screen.findByText('暂无对话', { selector: '[role="status"]' }))
      .toHaveClass('sr-only');
    expect(screen.getAllByText('暂无对话')).toHaveLength(2);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});

interface RenderOptions {
  open?: boolean;
  results?: SessionSearchResult[];
  search?: ReturnType<typeof searchModel>;
  activityBySessionId?: ReadonlyMap<string, SessionActivityViewModel>;
  managementBySessionId?: ReadonlyMap<string, SessionManagementViewModel>;
  managementActions?: SessionManagementController;
  onSelect?: (id: string) => void;
  onClose?: () => void;
}

function renderSearch(options: RenderOptions = {}) {
  return render(component(options));
}

function component(options: RenderOptions = {}) {
  return <LocaleProvider locale="zh"><DesktopSessionSearch
    open={options.open ?? true}
    results={options.results ?? []}
    activityBySessionId={options.activityBySessionId ?? new Map()}
    managementBySessionId={options.managementBySessionId ?? new Map()}
    managementActions={options.managementActions ?? managementActions()}
    search={options.search ?? searchModel()}
    onSelect={options.onSelect ?? vi.fn()}
    onClose={options.onClose ?? vi.fn()}
  /></LocaleProvider>;
}

function searchModel(overrides: Record<string, unknown> = {}) {
  return {
    query: '', scope: 'active' as const, includeContent: false,
    searching: false, error: null as 'unavailable' | null,
    setQuery: vi.fn(), setScope: vi.fn(), setIncludeContent: vi.fn(), retry: vi.fn(),
    ...overrides,
  };
}

function managementActions(overrides: Partial<SessionManagementController> = {}) {
  const ok = async () => ({ ok: true });
  return {
    rename: ok, setPinned: ok, archive: ok, stopAndArchive: ok,
    unarchive: ok, deletePermanently: async () => {}, ...overrides,
  } as SessionManagementController;
}

function management(id: string): SessionManagementViewModel {
  return {
    sessionId: id, isArchived: true, isPinned: false,
    isRunning: false, commands: ['unarchive', 'delete'],
  };
}

function session(id: string, title: string, archivedAt?: number): SessionInfo {
  return {
    id, title, model: 'test', messageCount: 0, createdAt: 1, updatedAt: 1,
    schemaVersion: 3, titleSource: 'manual', isPinned: false, recencyAt: 1,
    archivedAt,
  };
}

function result(info: SessionInfo): SessionSearchResult {
  return { session: info, match: 'title' };
}

function selectedOption(): HTMLElement {
  return screen.getByRole('option', { selected: true });
}
