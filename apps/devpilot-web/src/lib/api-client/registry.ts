/**
 * API 路由常量
 *
 * 集中声明后端路由字符串，避免散落各页的拼写错误。
 * 类型定义见 @/types/api-registry（模块增强）。
 *
 * 命名约定：DOMAIN_ACTION，值为 `METHOD:/path`。
 */

export const AUTH_ROUTES = {
  LOGIN: 'POST:/auth/login',
  REGISTER: 'POST:/auth/register',
  PROFILE: 'GET:/auth/profile',
} as const;

export const TEAM_ROUTES = {
  LIST: 'GET:/teams',
  DETAIL: 'GET:/teams/:id',
  CREATE: 'POST:/teams',
  UPDATE: 'PUT:/teams/:id',
  DELETE: 'DELETE:/teams/:id',
  ADD_MEMBER: 'POST:/teams/:id/members',
  REMOVE_MEMBER: 'DELETE:/teams/:id/members/:memberId',
  UPDATE_MEMBER_ROLE: 'PUT:/teams/:id/members/:memberId/role',
} as const;
