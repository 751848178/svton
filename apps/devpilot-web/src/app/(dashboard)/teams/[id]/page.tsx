'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState, Tabs } from '@svton/ui';
import { Button, ErrorBanner, Modal } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTeamDetail } from './hooks/use-team-detail';
import { MembersTab } from './components/members-tab';
import { SettingsTab } from './components/settings-tab';
import { AddMemberModal } from './components/add-member-modal';
import { BackArrowIcon } from './components/back-arrow-icon';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const teamId = params.id as string;
  const s = useTeamDetail(teamId);
  const goBack = () => router.push('/teams');

  if (s.isLoading && !s.currentTeamDetail) {
    return <LoadingState text={tc('loading')} />;
  }

  // 加载失败（有 error 且无详情）：展示可重试的错误，而非误报「不存在」
  if (!s.currentTeamDetail && s.error) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorBanner
          message={t('loadTeamFailed')}
          onRetry={() => s.fetchTeamDetail(teamId)}
        />
      </div>
    );
  }

  if (!s.currentTeamDetail) {
    return (
      <EmptyState
        text={t('teamNotFound')}
        action={
          <Button
            variant="outline"
            onClick={goBack}
          >
            {t('backToTeams')}
          </Button>
        }
      />
    );
  }

  const tabs = [
    {
      key: 'members',
      label: t('memberManagement'),
      children: (
        <MembersTab
          team={s.currentTeamDetail}
          canManageMembers={s.canManageMembers}
          onAddMember={() => s.setModalOpen(true)}
          onUpdateRole={s.handleUpdateRole}
          onRemove={s.handleRemoveMember}
        />
      ),
    },
    {
      key: 'settings',
      label: t('teamSettings'),
      children: (
        <SettingsTab
          editName={s.editName}
          editDesc={s.editDesc}
          canEditSettings={s.canEditSettings}
          saving={s.saving}
          onNameChange={s.setEditName}
          onDescChange={s.setEditDesc}
          onSubmit={s.handleSaveSettings}
          onDelete={() => s.setDeleteOpen(true)}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-2">
        <BackButton onClick={goBack} />
        <h1 className="text-2xl font-bold">{s.currentTeamDetail.name}</h1>
      </div>

      {s.error ? (
        <ErrorBanner
          message={s.error}
          variant="inline"
          onRetry={s.clearError}
          retryLabel={tc('close')}
        />
      ) : null}

      <Tabs items={tabs} />

      <AddMemberModal
        open={s.modalOpen}
        onClose={() => s.setModalOpen(false)}
        onAdd={s.handleAddMember}
      />

      <ConfirmDialog
        open={Boolean(s.removeTarget)}
        onOpenChange={(open) => {
          if (!open) s.setRemoveTarget(null);
        }}
        tone="danger"
        title={t('removeMemberTitle')}
        description={t('removeMemberConfirm')}
        confirmLabel={t('removeMember')}
        cancelLabel={tc('cancel')}
        onConfirm={() => s.handleConfirmRemoveMember(t('removeMemberSuccess'))}
      />

      <Modal
        open={s.deleteOpen}
        onClose={() => s.setDeleteOpen(false)}
        title={t('confirmDelete')}
        width={400}
      >
        <p className="text-muted-foreground">{t('deleteTeamModalText')}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => s.setDeleteOpen(false)}
          >
            {tc('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={s.handleDeleteTeam}
            disabled={s.deleting}
          >
            {tc('delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** 回退到团队列表的图标按钮（ghost icon button + a11y label）。 */
function BackButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('teams');
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={t('back')}
    >
      <BackArrowIcon />
    </Button>
  );
}
