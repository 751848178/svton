'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CaretDown, Check, GearSix, Plus } from '@phosphor-icons/react';
import { Avatar } from '@svton/ui';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { useTeamStore, Team } from '@/store/hooks';
import { CreateTeamModal } from './create-team-modal';
import { TeamSwitcherEmpty } from './team-switcher-empty';

export function TeamSwitcher() {
  const t = useTranslations('nav');
  const router = useRouter();
  const { teams, currentTeam, isLoading, fetchTeams, setCurrentTeam, createTeam } = useTeamStore();
  const [isOpen, { setTrue: openDropdown, setFalse: closeDropdown }] = useBoolean(false);
  const [modalOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeDropdown();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeDropdown();
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, closeDropdown]);

  const handleSelectTeam = usePersistFn((team: Team) => {
    setCurrentTeam(team);
    closeDropdown();
    router.refresh();
  });

  const handleCreateTeam = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      await createTeam(newTeamName.trim());
      setNewTeamName('');
      closeModal();
      router.refresh();
    } catch {
      // 错误由 store 处理
    } finally {
      setCreating(false);
    }
  });

  if (isLoading) {
    return (
      <div
        className="shrink-0"
        aria-hidden="true"
      >
        <div className="h-9 w-[148px] animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (teams.length === 0) {
    return <TeamSwitcherEmpty />;
  }

  const initials = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
    >
      <button
        ref={triggerRef}
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Avatar
          size="small"
          shape="square"
          className="rounded-md bg-muted font-bold text-foreground"
        >
          {initials(currentTeam?.name ?? '')}
        </Avatar>
        <span className="max-w-[140px] truncate text-foreground">
          {currentTeam?.name || t('selectTeam')}
        </span>
        <CaretDown
          size={14}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen ? (
        <div
          role="menu"
          aria-label={t('selectTeam')}
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover py-1 shadow-md"
        >
          <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{t('myTeams')}</p>
          {teams.map((team) => {
            const isCurrent = currentTeam?.id === team.id;
            return (
              <button
                key={team.id}
                role="menuitem"
                aria-current={isCurrent || undefined}
                onClick={() => handleSelectTeam(team)}
                className="flex min-h-11 w-full items-center gap-2.5 px-2 py-1.5 text-left hover:bg-accent"
              >
                <Avatar
                  size="small"
                  shape="square"
                  className="rounded-md bg-muted font-bold text-foreground"
                >
                  {initials(team.name)}
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{team.name}</span>
                  {typeof team.memberCount === 'number' ? (
                    <span className="block text-xs text-muted-foreground">
                      {t('teamMemberCount', { count: team.memberCount })}
                    </span>
                  ) : null}
                </span>
                {isCurrent ? (
                  <Check
                    size={16}
                    weight="bold"
                    aria-label={t('current')}
                    className="shrink-0 text-primary"
                  />
                ) : null}
              </button>
            );
          })}
          <div className="my-1 h-px bg-border" />
          <button
            role="menuitem"
            onClick={() => {
              closeDropdown();
              openModal();
            }}
            className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Plus
              size={15}
              aria-hidden="true"
              className="text-muted-foreground"
            />
            {t('createNewTeam')}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              closeDropdown();
              router.push('/teams');
            }}
            className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
          >
            <GearSix
              size={15}
              aria-hidden="true"
              className="text-muted-foreground"
            />
            {t('manageTeam')}
          </button>
        </div>
      ) : null}
      <CreateTeamModal
        open={modalOpen}
        onClose={closeModal}
        onSubmit={handleCreateTeam}
        teamName={newTeamName}
        setTeamName={setNewTeamName}
        creating={creating}
      />
    </div>
  );
}
