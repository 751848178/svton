'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTeamStore, MemberRole } from '@/store/team-store';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
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

  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('member');
  const [adding, setAdding] = useState(false);
  
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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;

    setAdding(true);
    try {
      await addMember(teamId, newMemberEmail.trim(), newMemberRole);
      setNewMemberEmail('');
      setNewMemberRole('member');
      setShowAddMember(false);
    } catch {
      // Error handled by store
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('确定要移除这个成员吗？')) return;
    await removeMember(teamId, memberId);
  };

  const handleUpdateRole = async (memberId: string, role: MemberRole) => {
    await updateMemberRole(teamId, memberId, role);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setSaving(true);
    try {
      await updateTeam(teamId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
    } catch {
      // Error handled by store
    } finally {
      setSaving(false);
    }
  };

  const myRole = currentTeamDetail?.members.find(
    (m) => m.role === 'owner' || m.role === 'admin'
  )?.role;
  const canManageMembers = myRole === 'owner' || myRole === 'admin';
  const canEditSettings = myRole === 'owner';

  if (isLoading && !currentTeamDetail) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  if (!currentTeamDetail) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">团队不存在或无权访问</p>
        <button
          onClick={() => router.push('/teams')}
          className="mt-4 text-primary hover:underline"
        >
          返回团队列表
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => router.push('/teams')}
          className="text-muted-foreground hover:text-foreground"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">{currentTeamDetail.name}</h1>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-sm underline">
            关闭
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            成员管理
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            团队设置
          </button>
        </nav>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">
              团队成员 ({currentTeamDetail.members.length})
            </h2>
            {canManageMembers && (
              <button
                onClick={() => setShowAddMember(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                添加成员
              </button>
            )}
          </div>

          <div className="border rounded-lg divide-y">
            {currentTeamDetail.members.map((member) => (
              <div key={member.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    {member.user.avatar ? (
                      <img
                        src={member.user.avatar}
                        alt={member.user.name || ''}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <span className="text-lg font-medium">
                        {(member.user.name || member.user.email)[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">
                      {member.user.name || member.user.email}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {member.user.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManageMembers && member.role !== 'owner' ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value as MemberRole)}
                      className="px-2 py-1 text-sm border rounded-md"
                    >
                      <option value="admin">管理员</option>
                      <option value="member">成员</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      member.role === 'owner'
                        ? 'bg-primary/10 text-primary'
                        : member.role === 'admin'
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {member.role === 'owner' ? '所有者' : member.role === 'admin' ? '管理员' : '成员'}
                    </span>
                  )}
                  {canManageMembers && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                团队名称
              </label>
              <input
                id="name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!canEditSettings}
                className="w-full max-w-md px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-muted"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                团队描述
              </label>
              <textarea
                id="description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                disabled={!canEditSettings}
                rows={3}
                className="w-full max-w-md px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:bg-muted"
              />
            </div>
            {canEditSettings && (
              <button
                type="submit"
                disabled={saving || !editName.trim()}
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存更改'}
              </button>
            )}
          </form>

          {canEditSettings && (
            <div className="mt-8 pt-8 border-t">
              <h3 className="text-lg font-medium text-destructive mb-2">危险区域</h3>
              <p className="text-sm text-muted-foreground mb-4">
                删除团队将永久删除所有相关数据，此操作不可撤销。
              </p>
              <button
                onClick={() => {
                  if (confirm('确定要删除这个团队吗？此操作不可撤销。')) {
                    // Delete team and redirect
                    router.push('/teams');
                  }
                }}
                className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除团队
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddMember(false)} />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">添加成员</h2>
            <form onSubmit={handleAddMember}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    邮箱地址 <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="输入成员邮箱"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="role" className="block text-sm font-medium mb-1">
                    角色
                  </label>
                  <select
                    id="role"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="member">成员</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={adding || !newMemberEmail.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {adding ? '添加中...' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
