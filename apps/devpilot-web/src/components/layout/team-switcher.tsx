'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { Modal } from '@/components/ui';
import { useTeamStore, Team } from '@/store/hooks';

export function TeamSwitcher() {
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

  if (!isLoading && teams.length === 0) {
    return (
      <div className="relative">
        <button
          onClick={openModal}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + 创建团队
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
    <div className="relative">
      <button
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
      >
        <span className="max-w-[120px] truncate">{currentTeam?.name || '选择团队'}</span>
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
                我的团队
              </div>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team)}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${currentTeam?.id === team.id ? 'bg-accent' : ''}`}
                >
                  <span className="flex-1 truncate text-left">{team.name}</span>
                  {currentTeam?.id === team.id ? <Tag color="green">当前</Tag> : null}
                </button>
              ))}
              <div className="my-1 border-t" />
              <button
                onClick={() => {
                  closeDropdown();
                  openModal();
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                + 创建新团队
              </button>
              <button
                onClick={() => {
                  closeDropdown();
                  router.push('/teams');
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                ⚙ 管理团队
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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="创建新团队"
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">团队名称</span>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="输入团队名称"
            className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={creating || !teamName.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
