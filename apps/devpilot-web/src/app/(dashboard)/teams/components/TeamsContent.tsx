'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, Modal } from '@/components/ui';
import { useTeams } from '../hooks/use-teams';
import { CreateTeamModal } from './create-team-modal';
import { TeamCard } from './team-card';
import type { Team } from '@/store/hooks';

/**
 * 团队管理客户端视图。
 *
 * 接收首屏 server 数据 initialTeams（SWR fallback），创建/删除团队等交互在此完成。
 */
export function TeamsContent({ initialTeams }: { initialTeams?: Team[] }) {
  const router = useRouter();
  const { teams, loading, create, remove } = useTeams(initialTeams);
  const [error, setError] = useState('');
  const [createOpen, { setTrue: openCreate, setFalse: closeCreate }] = useBoolean(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const clearError = usePersistFn(() => setError(''));

  const handleCreate = usePersistFn(async (name: string, description?: string) => {
    setError('');
    try {
      await create(name, description);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建团队失败');
      throw err;
    }
  });

  const handleDelete = usePersistFn(async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      await remove(deleteTarget);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除团队失败');
    }
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <PageHeader
          title="团队管理"
          description="管理您的团队和成员"
          actions={
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              + 创建团队
            </button>
          }
        />
      </div>

      {error ? (
        <ErrorBanner
          message={error}
          variant="inline"
          onRetry={clearError}
          retryLabel="关闭"
        />
      ) : null}

      {loading && teams.length === 0 ? (
        <LoadingState text="加载中..." />
      ) : teams.length === 0 ? (
        <EmptyState
          text="还没有团队"
          description="创建一个团队来开始协作"
          action={
            <button
              onClick={openCreate}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              创建第一个团队
            </button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onManage={() => router.push(`/teams/${team.id}`)}
              onDelete={() => setDeleteTarget(team.id)}
            />
          ))}
        </div>
      )}

      <CreateTeamModal
        open={createOpen}
        onClose={closeCreate}
        onCreate={handleCreate}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        width={400}
      >
        <p className="text-muted-foreground">
          确定要删除这个团队吗？此操作不可撤销，团队下的所有资源将被删除。
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setDeleteTarget(null)}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            取消
          </button>
          <button
            onClick={handleDelete}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            删除
          </button>
        </div>
      </Modal>
    </div>
  );
}
