'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { Button, PageHeader, ErrorBanner, Modal } from '@/components/ui';
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
          actions={<Button onClick={openCreate}>{t('createTeam')}</Button>}
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
          action={<Button onClick={openCreate}>{t('createFirstTeam')}</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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
        <p className="text-muted-foreground">{t('deleteTeamModalText')}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setDeleteTarget(null)}
          >
            {tc('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
          >
            {tc('delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
