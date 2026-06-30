/**
 * Service 注册与 Provider 组合
 *
 * 在应用根布局挂载 Providers，使所有页面共享同一组 service 实例（全局单例状态）。
 */

import { createServiceProvider } from '@svton/service';
import { AuthService } from './auth.service';
import { TeamService } from './team.service';
import { ProjectConfigService } from './project-config.service';

export const AuthServiceProvider = createServiceProvider(AuthService);
export const TeamServiceProvider = createServiceProvider(TeamService);
export const ProjectConfigServiceProvider = createServiceProvider(ProjectConfigService);

export { AuthService, TeamService, ProjectConfigService };
