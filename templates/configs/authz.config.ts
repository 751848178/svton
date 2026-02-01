import { ConfigService } from '@nestjs/config';
import { AuthzModuleOptions } from '@svton/nestjs-authz';

export const useAuthzConfig = (
  configService: ConfigService,
): AuthzModuleOptions => ({
  // RBAC 权限配置
  // 注意：roles 和 permissions 需要在运行时通过数据库或其他方式管理
  // 这里只配置模块选项
  userRoleField: 'role', // 用户对象中存储角色的字段名
  enableGlobalGuard: false, // 是否启用全局守卫
});
