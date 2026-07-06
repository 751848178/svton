'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('teams');
  const tc = useTranslations('common');
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
      setError(err instanceof Error ? err.message : t('createFailed'));
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
      setError(err instanceof Error ? err.message : t('deleteFailed'));
    }
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <PageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              + {t('createTeam')}
            </button>
          }
        />
      </div>

      {error ? (
        <ErrorBanner
          message={error}
          variant="inline"
          onRetry={clearError}
          retryLabel={tc('close')}
        />
      ) : null}

      {loading && teams.length === 0 ? (
        <LoadingState text={tc('loading')} />
      ) : teams.length === 0 ? (
        <EmptyState
          text={t('noTeams')}
          description={t('createTeamHint')}
          action={
            <button
              onClick={openCreate}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('createFirstTeam')}
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
        title={t('confirmDelete')}
        width={400}
      >
        <p className="text-muted-foreground">
          {t('deleteTeamModalText')}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setDeleteTarget(null)}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleDelete}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            {tc('delete')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
