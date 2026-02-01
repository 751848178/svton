'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export type MemberRole = 'owner' | 'admin' | 'member';

export interface TeamMember {
  id: string;
  userId: string;
  role: MemberRole;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  };
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  memberCount?: number;
  myRole?: MemberRole;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}

interface TeamState {
  teams: Team[];
  currentTeam: Team | null;
  currentTeamDetail: TeamDetail | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTeams: () => Promise<void>;
  fetchTeamDetail: (teamId: string) => Promise<void>;
  setCurrentTeam: (team: Team | null) => void;
  createTeam: (name: string, description?: string) => Promise<Team>;
  updateTeam: (teamId: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  addMember: (teamId: string, email: string, role?: MemberRole) => Promise<void>;
  removeMember: (teamId: string, memberId: string) => Promise<void>;
  updateMemberRole: (teamId: string, memberId: string, role: MemberRole) => Promise<void>;
  clearError: () => void;
}

// 设置 cookie（用于 API 请求携带 teamId）
function setTeamCookie(teamId: string | null) {
  if (typeof document === 'undefined') return;
  if (teamId) {
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
    document.cookie = `teamId=${encodeURIComponent(teamId)}; expires=${expires}; path=/`;
  } else {
    document.cookie = `teamId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      teams: [],
      currentTeam: null,
      currentTeamDetail: null,
      isLoading: false,
      error: null,

      fetchTeams: async () => {
        set({ isLoading: true, error: null });
        try {
          const teams = await api.get<Team[]>('/teams');
          set({ teams });
          
          // 如果没有当前团队但有团队列表，自动选择第一个
          const { currentTeam } = get();
          if (!currentTeam && teams.length > 0) {
            get().setCurrentTeam(teams[0]);
          }
        } catch (err) {
          set({ error: err instanceof Error ? err.message : '获取团队列表失败' });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchTeamDetail: async (teamId: string) => {
        set({ isLoading: true, error: null });
        try {
          const detail = await api.get<TeamDetail>(`/teams/${teamId}`);
          set({ currentTeamDetail: detail });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : '获取团队详情失败' });
        } finally {
          set({ isLoading: false });
        }
      },

      setCurrentTeam: (team: Team | null) => {
        setTeamCookie(team?.id || null);
        set({ currentTeam: team, currentTeamDetail: null });
      },

      createTeam: async (name: string, description?: string) => {
        set({ isLoading: true, error: null });
        try {
          const team = await api.post<Team>('/teams', { name, description });
          set((state) => ({ teams: [...state.teams, team] }));
          // 自动切换到新创建的团队
          get().setCurrentTeam(team);
          return team;
        } catch (err) {
          const message = err instanceof Error ? err.message : '创建团队失败';
          set({ error: message });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      updateTeam: async (teamId: string, data: { name?: string; description?: string }) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await api.put<Team>(`/teams/${teamId}`, data);
          set((state) => ({
            teams: state.teams.map((t) => (t.id === teamId ? updated : t)),
            currentTeam: state.currentTeam?.id === teamId ? updated : state.currentTeam,
          }));
        } catch (err) {
          set({ error: err instanceof Error ? err.message : '更新团队失败' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      deleteTeam: async (teamId: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.delete(`/teams/${teamId}`);
          const { teams, currentTeam } = get();
          const newTeams = teams.filter((t) => t.id !== teamId);
          set({ teams: newTeams });
          
          // 如果删除的是当前团队，切换到其他团队
          if (currentTeam?.id === teamId) {
            get().setCurrentTeam(newTeams[0] || null);
          }
        } catch (err) {
          set({ error: err instanceof Error ? err.message : '删除团队失败' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      addMember: async (teamId: string, email: string, role: MemberRole = 'member') => {
        set({ isLoading: true, error: null });
        try {
          await api.post(`/teams/${teamId}/members`, { email, role });
          // 刷新团队详情
          await get().fetchTeamDetail(teamId);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : '添加成员失败' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      removeMember: async (teamId: string, memberId: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.delete(`/teams/${teamId}/members/${memberId}`);
          // 刷新团队详情
          await get().fetchTeamDetail(teamId);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : '移除成员失败' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      updateMemberRole: async (teamId: string, memberId: string, role: MemberRole) => {
        set({ isLoading: true, error: null });
        try {
          await api.put(`/teams/${teamId}/members/${memberId}/role`, { role });
          // 刷新团队详情
          await get().fetchTeamDetail(teamId);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : '更新角色失败' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'team-storage',
      partialize: (state) => ({ currentTeam: state.currentTeam }),
      onRehydrateStorage: () => (state) => {
        // 恢复时同步 cookie
        if (state?.currentTeam) {
          setTeamCookie(state.currentTeam.id);
        }
      },
    }
  )
);
