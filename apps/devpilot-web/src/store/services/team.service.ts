/**
 * 团队 Service
 *
 * 单一职责：管理团队列表、当前团队与成员 CRUD，同步 teamId cookie。
 */

import { Service, observable, action } from '@svton/service';
import { apiAsync } from '@/lib/api-client';
import { TEAM_ROUTES } from '@/lib/api-client/registry';
import type { Team, TeamDetail, TeamMember } from '@/types/api-registry';
import { syncTeamCookie } from '@/lib/auth/token-storage';

export type { TeamMember };

@Service()
export class TeamService {
  @observable() teams: Team[] = [];
  @observable() currentTeam: Team | null = null;
  @observable() currentTeamDetail: TeamDetail | null = null;
  @observable() isLoading = false;
  @observable() error: string | null = null;

  private fail(err: unknown, fallback: string): void {
    this.error = err instanceof Error ? err.message : fallback;
  }

  @action() async fetchTeams(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const teams = await apiAsync(TEAM_ROUTES.LIST);
      this.teams = teams;
      if (!this.currentTeam && teams.length > 0) {
        this.setCurrentTeam(teams[0]);
      }
    } catch (err) {
      this.fail(err, '获取团队列表失败');
    } finally {
      this.isLoading = false;
    }
  }

  @action() async fetchTeamDetail(teamId: string): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      this.currentTeamDetail = await apiAsync(TEAM_ROUTES.DETAIL, { id: teamId });
    } catch (err) {
      this.fail(err, '获取团队详情失败');
    } finally {
      this.isLoading = false;
    }
  }

  @action() setCurrentTeam(team: Team | null): void {
    syncTeamCookie(team?.id || null);
    this.currentTeam = team;
    this.currentTeamDetail = null;
  }

  @action() async createTeam(name: string, description?: string): Promise<Team> {
    this.isLoading = true;
    this.error = null;
    try {
      const team = await apiAsync(TEAM_ROUTES.CREATE, { name, description });
      this.teams = [...this.teams, team];
      this.setCurrentTeam(team);
      return team;
    } catch (err) {
      this.fail(err, '创建团队失败');
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  @action() async updateTeam(
    teamId: string,
    data: { name?: string; description?: string },
  ): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const updated = await apiAsync(TEAM_ROUTES.UPDATE, { id: teamId, ...data });
      this.teams = this.teams.map((t) => (t.id === teamId ? updated : t));
      if (this.currentTeam?.id === teamId) this.currentTeam = updated;
    } catch (err) {
      this.fail(err, '更新团队失败');
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  @action() async deleteTeam(teamId: string): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      await apiAsync(TEAM_ROUTES.DELETE, { id: teamId });
      const next = this.teams.filter((t) => t.id !== teamId);
      this.teams = next;
      if (this.currentTeam?.id === teamId) this.setCurrentTeam(next[0] || null);
    } catch (err) {
      this.fail(err, '删除团队失败');
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  @action() async addMember(teamId: string, email: string, role = 'member'): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      await apiAsync(TEAM_ROUTES.ADD_MEMBER, { id: teamId, email, role });
      await this.fetchTeamDetail(teamId);
    } catch (err) {
      this.fail(err, '添加成员失败');
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  @action() async removeMember(teamId: string, memberId: string): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      await apiAsync(TEAM_ROUTES.REMOVE_MEMBER, { id: teamId, memberId });
      await this.fetchTeamDetail(teamId);
    } catch (err) {
      this.fail(err, '移除成员失败');
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  @action() async updateMemberRole(teamId: string, memberId: string, role: string): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      await apiAsync(TEAM_ROUTES.UPDATE_MEMBER_ROLE, { id: teamId, memberId, role });
      await this.fetchTeamDetail(teamId);
    } catch (err) {
      this.fail(err, '更新角色失败');
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  @action() clearError(): void {
    this.error = null;
  }
}
