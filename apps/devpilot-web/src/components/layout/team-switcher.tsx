'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { StatusTag } from '@/components/ui';
import { useTeamStore, Team } from '@/store/hooks';
import { CreateTeamModal } from './create-team-modal';

export function TeamSwitcher() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const router = useRouter();
  const { teams, currentTeam, isLoading, fetchTeams, setCurrentTeam, createTeam } = useTeamStore();
  const [isOpen, { setTrue: openDropdown, setFalse: closeDropdown }] = useBoolean(false);
  const [modalOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

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

  // 加载期渲染与最终控件等宽等高(h-11 / w-[150px])的骨架占位,消除布局跳动
  if (isLoading) {
    return (
      <div className="relative shrink-0">
        <div
          aria-hidden="true"
          className="h-11 w-[150px] animate-pulse rounded-md border bg-muted"
        />
      </div>
    );
  }

  if (!isLoading && teams.length === 0) {
    return (
      <div className="relative shrink-0">
        <div className="flex max-w-[150px] min-h-11 items-center gap-2 rounded-md border px-3 py-2">
          <span className="text-xs text-muted-foreground">{t('noTeamHint')}</span>
          <button
            onClick={openModal}
            className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline"
          >
            {t('createTeam')}
          </button>
        </div>
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

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        className="flex min-h-11 max-w-[150px] items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
      >
        <span className="max-w-[120px] truncate">{currentTeam?.name || t('selectTeam')}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {isOpen ? (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={closeDropdown}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border bg-popover shadow-lg">
            <div className="p-1">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {t('myTeams')}
              </div>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team)}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent ${currentTeam?.id === team.id ? 'bg-accent' : ''}`}
                >
                  <span className="flex-1 truncate text-left">{team.name}</span>
                  {currentTeam?.id === team.id ? (
                    <StatusTag status="active" label={t('current')} />
                  ) : null}
                </button>
              ))}
              <div className="my-1 border-t" />
              <button
                onClick={() => {
                  closeDropdown();
                  openModal();
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
              >
                {t('createNewTeam')}
              </button>
              <button
                onClick={() => {
                  closeDropdown();
                  router.push('/teams');
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
              >
                {t('manageTeam')}
              </button>
            </div>
          </div>
        </>
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
