/**
 * 兼容性 Hooks
 *
 * 让旧页面以原 zustand hook 风格调用新 @svton/service。
 * 页面迁移到新范式（直接 useService().useState.xxx）后，本文件可删除。
 */

import { AuthServiceProvider, TeamServiceProvider, ProjectConfigServiceProvider } from './services';

// 兼容：重新导出旧 store 暴露的类型，避免全量改动 import 路径
export type {
  ProjectConfig,
  ProjectResourceConfig,
  DatabaseEngine,
  ResourceConfigMode,
} from './services/project-config.types';
export type { Team, TeamDetail } from '@/types/api-registry';
export type { TeamMember as Member } from './services/team.service';

// MemberRole 兼容（旧 store 用字符串字面量联合）
export type MemberRole = 'owner' | 'admin' | 'member';

/**
 * 等价旧 useAuthStore()：返回扁平的 token/user/isAuthenticated/isLoading + actions。
 */
export function useAuthStore() {
  const svc = AuthServiceProvider.useService();
  return {
    token: svc.useState.token(),
    user: svc.useState.user(),
    isAuthenticated: svc.useState.isAuthenticated(),
    isLoading: svc.useState.isLoading(),
    login: svc.useAction.login(),
    register: svc.useAction.register(),
    logout: svc.useAction.logout(),
    checkAuth: svc.useAction.checkAuth(),
  };
}

/**
 * 等价旧 useTeamStore()。
 */
export function useTeamStore() {
  const svc = TeamServiceProvider.useService();
  return {
    teams: svc.useState.teams(),
    currentTeam: svc.useState.currentTeam(),
    currentTeamDetail: svc.useState.currentTeamDetail(),
    isLoading: svc.useState.isLoading(),
    error: svc.useState.error(),
    fetchTeams: svc.useAction.fetchTeams(),
    fetchTeamDetail: svc.useAction.fetchTeamDetail(),
    setCurrentTeam: svc.useAction.setCurrentTeam(),
    createTeam: svc.useAction.createTeam(),
    updateTeam: svc.useAction.updateTeam(),
    deleteTeam: svc.useAction.deleteTeam(),
    addMember: svc.useAction.addMember(),
    removeMember: svc.useAction.removeMember(),
    updateMemberRole: svc.useAction.updateMemberRole(),
    clearError: svc.useAction.clearError(),
  };
}

/**
 * 等价旧 useProjectConfigStore()。返回 config + currentStep + actions。
 */
export function useProjectConfigStore() {
  const svc = ProjectConfigServiceProvider.useService();
  const config = svc.useState.config();
  return {
    config,
    currentStep: svc.useState.currentStep(),
    setBasicInfo: svc.useAction.setBasicInfo(),
    setSubProjects: svc.useAction.setSubProjects(),
    toggleFeature: svc.useAction.toggleFeature(),
    setFeatures: svc.useAction.setFeatures(),
    setResource: svc.useAction.setResource(),
    setResources: svc.useAction.setResources(),
    setDatabase: svc.useAction.setDatabase(),
    setUiLibrary: svc.useAction.setUiLibrary(),
    setHooks: svc.useAction.setHooks(),
    setGitConfig: svc.useAction.setGitConfig(),
    setCurrentStep: svc.useAction.setCurrentStep(),
    reset: svc.useAction.reset(),
    loadPreset: svc.useAction.loadPreset(),
  };
}
