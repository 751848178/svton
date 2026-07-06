'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState, Tabs } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useTeamStore, MemberRole } from '@/store/hooks';
import { MemberRow } from './components/member-row';
import { AddMemberModal } from './components/add-member-modal';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('teams');
  const tc = useTranslations('common');
  const teamId = params.id as string;
  const {
    currentTeamDetail,
    isLoading,
    error,
    fetchTeamDetail,
    updateTeam,
    addMember,
    removeMember,
    updateMemberRole,
    clearError,
  } = useTeamStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeamDetail(teamId);
  }, [teamId, fetchTeamDetail]);

  useEffect(() => {
    if (currentTeamDetail) {
      setEditName(currentTeamDetail.name);
      setEditDesc(currentTeamDetail.description || '');
    }
  }, [currentTeamDetail]);

  const handleAddMember = usePersistFn(async (email: string, role: MemberRole) => {
    await addMember(teamId, email, role);
  });
  const handleRemoveMember = usePersistFn(async (memberId: string) => {
    if (!confirm(t('removeMemberConfirm'))) return;
    await removeMember(teamId, memberId);
  });
  const handleUpdateRole = usePersistFn(async (memberId: string, role: MemberRole) => {
    await updateMemberRole(teamId, memberId, role);
  });
  const handleSaveSettings = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateTeam(teamId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  });

  const myRole = currentTeamDetail?.members.find(
    (m) => m.role === 'owner' || m.role === 'admin',
  )?.role;
  const canManageMembers = myRole === 'owner' || myRole === 'admin';
  const canEditSettings = myRole === 'owner';

  if (isLoading && !currentTeamDetail) return <LoadingState text={tc('loading')} />;

  if (!currentTeamDetail) {
    return (
      <EmptyState
        text={t('teamNotFound')}
        action={
          <button
            onClick={() => router.push('/teams')}
            className="text-primary hover:underline"
          >
            {t('backToTeams')}
          </button>
        }
      />
    );
  }

  const tabs = [
    {
      key: 'members',
      label: t('memberManagement'),
      children: (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">{t('teamMembersCount', { count: currentTeamDetail.members.length })}</h2>
            {canManageMembers ? (
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                + {t('addMember')}
              </button>
            ) : null}
          </div>
          <div className="divide-y rounded-lg border">
            {currentTeamDetail.members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                canManage={canManageMembers}
                onUpdateRole={handleUpdateRole}
                onRemove={handleRemoveMember}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'settings',
      label: t('teamSettings'),
      children: (
        <div>
          <form
            onSubmit={handleSaveSettings}
            className="space-y-4"
          >
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('teamName')}</span>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!canEditSettings}
                className="w-full max-w-md rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{tc('description')}</span>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                disabled={!canEditSettings}
                rows={3}
                className="w-full max-w-md resize-none rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted"
              />
            </label>
            {canEditSettings ? (
              <button
                type="submit"
                disabled={saving || !editName.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? t('saving') : t('saveChanges')}
              </button>
            ) : null}
          </form>
          {canEditSettings ? (
            <div className="mt-8 border-t pt-8">
              <h3 className="mb-2 text-lg font-medium text-destructive">{t('dangerZone')}</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {t('deleteTeamWarning')}
              </p>
              <button
                onClick={() => {
                  if (confirm(t('deleteTeamConfirm'))) router.push('/teams');
                }}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                {t('deleteTeam')}
              </button>
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={() => router.push('/teams')}
          className="text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">{currentTeamDetail.name}</h1>
      </div>

      {error ? (
        <ErrorBanner
          message={error}
          variant="inline"
          onRetry={clearError}
          retryLabel={tc('close')}
        />
      ) : null}

      <Tabs items={tabs} />

      <AddMemberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAddMember}
      />
    </div>
  );
}
