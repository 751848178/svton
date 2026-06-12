import { ConfigService } from '@nestjs/config';
import { AuthzModuleOptions } from '@svton/nestjs-authz';

export const useAuthzConfig = (
  configService: ConfigService,
): AuthzModuleOptions => ({
  // 角色与权限配置
  // schema / roles / permissions 通常在运行时通过数据库或配置中心管理
  // 默认先读取 req.user.role；如果不存在，会自动尝试 req.user.roles
  userRoleField: 'role', // 用户对象中存储角色的字段名
  userPermissionsField: 'permissions', // 用户对象中存储直接权限的字段名
  enableGlobalGuard: false, // 是否启用全局守卫
  // schema: {
  //   roles: {
  //     admin: { permissions: ['*'] },
  //   },
  // },
});
