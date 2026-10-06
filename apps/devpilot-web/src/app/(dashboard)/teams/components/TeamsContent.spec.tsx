// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamsContent } from './TeamsContent';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  useTeams: vi.fn(),
  capturedCreate: undefined as ((name: string, description?: string) => Promise<void>) | undefined,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@svton/hooks', () => ({
  useBoolean: () => [false, { setTrue: vi.fn(), setFalse: vi.fn() }],
  usePersistFn: (fn: unknown) => fn,
}));
vi.mock('@svton/ui', () => ({
  LoadingState: ({ text }: { text: string }) => <div>{text}</div>,
  EmptyState: ({ text, action }: { text: string; action: React.ReactNode }) => (
    <div>
      {text}
      {action}
    </div>
  ),
}));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    size: _size,
    variant: _variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
  }) => <button {...props}>{children}</button>,
  PageHeader: ({ title, description, actions }: Record<string, React.ReactNode>) => (
    <header>
      {title}
      {description}
      {actions}
    </header>
  ),
  ErrorBanner: ({ message }: { message?: string }) => (message ? <div>{message}</div> : null),
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));
vi.mock('../hooks/use-teams', () => ({
  useTeams: () => mocks.useTeams(),
}));
vi.mock('./create-team-modal', () => ({
  CreateTeamModal: ({
    onCreate,
  }: {
    onCreate: (name: string, description?: string) => Promise<void>;
  }) => {
    mocks.capturedCreate = onCreate;
    return null;
  },
}));
vi.mock('./team-card', () => ({ TeamCard: () => <div>team-card</div> }));

describe('TeamsContent team prerequisite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    mocks.replace.mockReset();
    mocks.create.mockReset().mockResolvedValue({ id: 'team-1', name: 'First Team' });
    mocks.remove.mockReset();
    mocks.capturedCreate = undefined;
    mocks.useTeams.mockReturnValue({
      teams: [],
      currentTeam: null,
      loading: false,
      create: mocks.create,
      remove: mocks.remove,
    });
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('replaces the generic empty state with one high-priority create action', async () => {
    await act(async () =>
      root.render(
        <TeamsContent
          teamRequired
          returnTo="/projects?view=delivery"
        />,
      ),
    );

    expect(container.textContent).toContain('teamRequiredTitle');
    expect(container.textContent).toContain('teamRequiredDescription');
    expect(container.textContent).not.toContain('noTeams');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'teamRequiredAction',
    ]);

    await act(async () => {
      await mocks.capturedCreate?.('First Team');
    });

    expect(mocks.create).toHaveBeenCalledWith('First Team', undefined);
    expect(mocks.replace).toHaveBeenCalledWith('/projects?view=delivery');
  });

  it('returns automatically after an existing team context is restored', async () => {
    mocks.useTeams.mockReturnValue({
      teams: [{ id: 'team-1', name: 'Existing Team' }],
      currentTeam: { id: 'team-1', name: 'Existing Team' },
      loading: false,
      create: mocks.create,
      remove: mocks.remove,
    });

    await act(async () =>
      root.render(
        <TeamsContent
          teamRequired
          returnTo="/projects"
        />,
      ),
    );

    expect(container.textContent).toContain('restoringTeamContext');
    expect(mocks.replace).toHaveBeenCalledWith('/projects');
  });
});
