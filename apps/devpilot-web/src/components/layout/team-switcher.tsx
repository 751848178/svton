'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { Modal } from '@/components/ui';
import { useTeamStore, Team } from '@/store/hooks';

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
        <button
          onClick={openModal}
          className="flex min-h-11 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('createTeam')}
        </button>
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
        <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
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
                  {currentTeam?.id === team.id ? <Tag color="green">{t('current')}</Tag> : null}
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

function CreateTeamModal({
  open,
  onClose,
  onSubmit,
  teamName,
  setTeamName,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  teamName: string;
  setTeamName: (name: string) => void;
  creating: boolean;
}) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createNewTeam')}
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('teamName')}</span>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder={t('teamNamePlaceholder')}
            className="min-h-11 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={creating || !teamName.trim()}
            className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? t('creating') : tc('create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
