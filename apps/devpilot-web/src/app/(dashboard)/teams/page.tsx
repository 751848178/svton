'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamStore, Team } from '@/store/team-store';

export default function TeamsPage() {
  const router = useRouter();
  const { teams, isLoading, error, fetchTeams, createTeam, deleteTeam, clearError } = useTeamStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreating(true);
    try {
      await createTeam(newTeamName.trim(), newTeamDesc.trim() || undefined);
      setNewTeamName('');
      setNewTeamDesc('');
      setShowCreateModal(false);
    } catch {
      // Error handled by store
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await deleteTeam(teamId);
      setDeleteConfirm(null);
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">团队管理</h1>
          <p className="text-muted-foreground mt-1">管理您的团队和成员</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          创建团队
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-sm underline">
            关闭
          </button>
        </div>
      )}

      {isLoading && teams.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium">还没有团队</h3>
          <p className="mt-2 text-muted-foreground">创建一个团队来开始协作</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            创建第一个团队
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onManage={() => router.push(`/teams/${team.id}`)}
              onDelete={() => setDeleteConfirm(team.id)}
            />
          ))}
        </div>
      )}

      {/* 创建团队弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">创建新团队</h2>
            <form onSubmit={handleCreateTeam}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="teamName" className="block text-sm font-medium mb-1">
                    团队名称 <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="teamName"
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="输入团队名称"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="teamDesc" className="block text-sm font-medium mb-1">
                    团队描述
                  </label>
                  <textarea
                    id="teamDesc"
                    value={newTeamDesc}
                    onChange={(e) => setNewTeamDesc(e.target.value)}
                    placeholder="输入团队描述（可选）"
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTeamName.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-2">确认删除</h2>
            <p className="text-muted-foreground mb-4">
              确定要删除这个团队吗？此操作不可撤销，团队下的所有资源将被删除。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteTeam(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamCard({
  team,
  onManage,
  onDelete,
}: {
  team: Team;
  onManage: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{team.name}</h3>
            {team.myRole === 'owner' && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                所有者
              </span>
            )}
            {team.myRole === 'admin' && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500">
                管理员
              </span>
            )}
          </div>
          {team.description && (
            <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {team.memberCount || 1} 成员
            </span>
            <span>创建于 {new Date(team.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onManage}
            className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
          >
            管理
          </button>
          {team.myRole === 'owner' && (
            <button
              onClick={onDelete}
              className="px-3 py-1.5 text-sm font-medium rounded-md text-destructive hover:bg-destructive/10"
            >
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
