/**
 * 团队详情页状态与操作
 *
 * 单一职责：管理编辑态、成员增删/改角色、保存/删除团队的副作用（不含 UI、不含 i18n 文案）。
 * 需要展示给用户的提示文案由调用方（组件）通过参数传入，保持 hook 与 next-intl 解耦。
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePersistFn } from '@svton/hooks';
import { feedback } from '@/components/ui/feedback/feedback';
import { useAuthStore, useTeamStore, MemberRole } from '@/store/hooks';

export function useTeamDetail(teamId: string) {
  const router = useRouter();
  const {
    currentTeamDetail,
    isLoading,
    error,
    fetchTeamDetail,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
    updateMemberRole,
    clearError,
  } = useTeamStore();
  const { user } = useAuthStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
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
  const handleRemoveMember = usePersistFn((memberId: string) => {
    setRemoveTarget(memberId);
  });
  const handleConfirmRemoveMember = usePersistFn(async (removedMessage: string) => {
    if (!removeTarget) return;
    await removeMember(teamId, removeTarget);
    feedback.success(removedMessage);
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
  const handleDeleteTeam = usePersistFn(async () => {
    setDeleting(true);
    try {
      await deleteTeam(teamId);
      setDeleteOpen(false);
      router.push('/teams');
    } catch {
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  });

  const myRole = currentTeamDetail?.members.find((m) => m.userId === user?.id)?.role ?? null;

  return {
    currentTeamDetail,
    isLoading,
    error,
    clearError,
    fetchTeamDetail,
    modalOpen,
    setModalOpen,
    deleteOpen,
    setDeleteOpen,
    deleting,
    removeTarget,
    setRemoveTarget,
    editName,
    setEditName,
    editDesc,
    setEditDesc,
    saving,
    canManageMembers: myRole === 'owner' || myRole === 'admin',
    canEditSettings: myRole === 'owner',
    handleAddMember,
    handleRemoveMember,
    handleConfirmRemoveMember,
    handleUpdateRole,
    handleSaveSettings,
    handleDeleteTeam,
  };
}
