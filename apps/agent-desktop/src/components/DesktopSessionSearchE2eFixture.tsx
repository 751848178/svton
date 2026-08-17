import React, { useMemo, useState } from 'react';
import type {
  SessionInfo,
  SessionActivityViewModel,
  SessionManagementController,
  SessionManagementViewModel,
  SessionSearchResult,
} from '@svton/agent-client';
import type { SessionSearchModel } from '@svton/agent-ui';
import { DesktopSessionSearch } from './DesktopSessionSearch';

const STATES = ['active', 'loading', 'archived', 'empty', 'error'] as const;
type FixtureState = typeof STATES[number];

export function DesktopSessionSearchE2eFixture() {
  const state = readFixtureState();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [scope, setScopeState] = useState<'active' | 'archived'>(
    state === 'archived' ? 'archived' : 'active',
  );
  const [includeContent, setIncludeContent] = useState(false);
  const [searching] = useState(state === 'loading');
  const [error, setError] = useState<'unavailable' | null>(
    state === 'error' ? 'unavailable' : null,
  );
  const [results, setResults] = useState<SessionSearchResult[]>(() => fixtureResults(state));
  const [selected, setSelected] = useState<string | null>(null);
  const archived = useMemo(() => archivedSession(), []);
  const search: SessionSearchModel = {
    query,
    scope,
    includeContent,
    searching,
    error,
    setQuery: (value) => {
      setQuery(value);
      setResults(activeResults().filter(({ session }) =>
        session.title.toLocaleLowerCase().includes(value.toLocaleLowerCase()),
      ));
    },
    setScope: (value) => {
      setScopeState(value);
      setResults(value === 'archived' ? [{ session: archived, match: 'title' }] : activeResults());
    },
    setIncludeContent,
    retry: () => { setError(null); setResults(activeResults()); },
  };
  const management = new Map<string, SessionManagementViewModel>([[archived.id, {
    sessionId: archived.id,
    isArchived: true,
    isPinned: false,
    isRunning: false,
    commands: ['unarchive', 'delete'],
  }]]);
  const actions: SessionManagementController = {
    rename: async () => ({ ok: true }),
    setPinned: async () => ({ ok: true }),
    archive: async () => ({ ok: true }),
    stopAndArchive: async () => ({ ok: true }),
    unarchive: async (id) => {
      if (id !== archived.id) return { ok: false, reason: 'invalid' };
      setResults((current) => current.filter(({ session }) => session.id !== id));
      return { ok: true };
    },
    deletePermanently: async () => {},
  };
  return (
    <main className="min-h-screen bg-background p-6 text-foreground" data-e2e-search-state={state}>
      <button type="button" onClick={() => setOpen(true)} className="rounded border border-border px-3 py-2">
        搜索
      </button>
      <p data-e2e-selected>{selected ?? 'none'}</p>
      <DesktopSessionSearch
        open={open}
        results={results}
        activityBySessionId={activityBySessionId()}
        managementBySessionId={management}
        managementActions={actions}
        search={search}
        onSelect={(id) => { setSelected(id); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </main>
  );
}

function readFixtureState(): FixtureState {
  const value = new URLSearchParams(window.location.search).get('state');
  return STATES.includes(value as FixtureState) ? value as FixtureState : 'active';
}

function fixtureResults(state: FixtureState): SessionSearchResult[] {
  if (state === 'archived') return [{ session: archivedSession(), match: 'title' }];
  if (state === 'empty' || state === 'error') return [];
  return activeResults();
}

function activeResults(): SessionSearchResult[] {
  return [
    { session: session('alpha', 'Release checklist', 5), match: 'title' },
    { session: session('beta', 'Responsive shell review', 4), match: 'content', snippet: 'Verify compact search focus and scroll containment.' },
    { session: session('gamma', 'Accessibility pass', 3), match: 'title' },
  ];
}

function archivedSession(): SessionInfo {
  return {
    ...session('archived', 'Archived deployment notes', 2),
    archivedAt: Date.now() - 60 * 60 * 1000,
  };
}

function session(id: string, title: string, hoursAgo: number): SessionInfo {
  const updatedAt = Date.now() - hoursAgo * 60 * 60 * 1000;
  return {
    id, title, updatedAt, createdAt: updatedAt - 24 * 60 * 60 * 1000,
    recencyAt: updatedAt,
    model: 'fixture', messageCount: 2, schemaVersion: 3,
    titleSource: 'manual', isPinned: false,
  };
}

function activityBySessionId(): ReadonlyMap<string, SessionActivityViewModel> {
  return new Map([['beta', {
    sessionId: 'beta', phase: 'inProgress', isUnread: false, terminal: null,
    statusLabel: '运行中', statusDescription: '任务正在运行',
  }]]);
}
