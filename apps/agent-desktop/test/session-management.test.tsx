import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SessionInfo,
  SessionManagementController,
  SessionManagementViewModel,
  SessionSearchResult,
} from '@svton/agent-client';
import { Sidebar } from '../src/components/Sidebar';
import { DesktopSessionSearch } from '../src/components/DesktopSessionSearch';

const actions: SessionManagementController = {
  rename: vi.fn(async () => ({ ok: true })),
  setPinned: vi.fn(async () => ({ ok: true })),
  archive: vi.fn(async () => ({ ok: true })),
  stopAndArchive: vi.fn(async () => ({ ok: true })),
  unarchive: vi.fn(async () => ({ ok: true })),
  deletePermanently: vi.fn(async () => {}),
};
const search = {
  query: '', scope: 'active' as const, includeContent: false,
  searching: false, error: null,
  setQuery: vi.fn(), setScope: vi.fn(), setIncludeContent: vi.fn(), retry: vi.fn(),
};

describe('desktop session management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('keeps the primary sidebar on active sessions when modal results are archived', () => {
    render(<Sidebar
      config={null}
      activeSessions={[session('active', 'Active')]}
      searchResults={[result(session('archived', 'Archived', 20))]}
      sessionSearch={search}
      activityBySessionId={new Map()}
      managementBySessionId={new Map()}
      managementActions={actions}
      currentSessionId="active"
      projects={[]}
      currentProjectId={null}
      onNewChat={vi.fn()}
      onSwitchSession={vi.fn()}
      onNavigate={vi.fn()}
      onSwitchProject={vi.fn()}
      onOpenProjectFolder={vi.fn()}
      onDeleteProject={vi.fn()}
      activeView="chat"
    />);
    expect(screen.getByRole('button', { name: /Active/ })).toBeInTheDocument();
    expect(screen.queryByText('Archived')).not.toBeInTheDocument();
  });

  it('keeps archived options disabled and exposes Unarchive outside the listbox', () => {
    const onSelect = vi.fn();
    const info = session('archived', 'Archived', 20);
    const management: SessionManagementViewModel = {
      sessionId: info.id, isArchived: true, isPinned: false,
      isRunning: false, commands: ['unarchive', 'delete'],
    };
    render(<DesktopSessionSearch
      open
      results={[result(info)]}
      activityBySessionId={new Map()}
      managementBySessionId={new Map([[info.id, management]])}
      managementActions={actions}
      search={search}
      onSelect={onSelect}
      onClose={vi.fn()}
    />);

    const option = screen.getByRole('option', { name: /Archived/ });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(within(option).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消归档“Archived”' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clamps keyboard selection when results change without query changes', () => {
    const onSelect = vi.fn();
    const props = {
      activityBySessionId: new Map(), managementBySessionId: new Map(),
      managementActions: actions, search, onSelect, onClose: vi.fn(),
    };
    const { rerender } = render(<DesktopSessionSearch
      open
      {...props}
      results={[result(session('a', 'A')), result(session('b', 'B'))]}
    />);
    fireEvent.keyDown(screen.getByRole('dialog', { name: '搜索对话' }), { key: 'ArrowDown' });
    rerender(<DesktopSessionSearch open {...props} results={[result(session('a', 'A'))]} />);
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('opens one search layer with Ctrl+K, refocuses it, and restores the invoker', async () => {
    render(<>
      <input aria-label="Composer" />
      <Sidebar
        config={null}
        activeSessions={[session('active', 'Active')]}
        searchResults={[result(session('active', 'Active'))]}
        sessionSearch={search}
        activityBySessionId={new Map()}
        managementBySessionId={new Map()}
        managementActions={actions}
        currentSessionId="active"
        projects={[]}
        currentProjectId={null}
        onNewChat={vi.fn()}
        onSwitchSession={vi.fn()}
        onNavigate={vi.fn()}
        onSwitchProject={vi.fn()}
        onOpenProjectFolder={vi.fn()}
        onDeleteProject={vi.fn()}
        activeView="chat"
      />
    </>);
    const invoker = screen.getByRole('textbox', { name: 'Composer' });
    invoker.focus();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const query = await screen.findByRole('combobox');
    await waitFor(() => expect(query).toHaveFocus());
    expect(document.querySelectorAll('[data-svton-modal-layer]')).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(document.querySelectorAll('[data-svton-modal-layer]')).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '搜索对话' })).not.toBeInTheDocument());
    await waitFor(() => expect(invoker).toHaveFocus());
  });
});

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
