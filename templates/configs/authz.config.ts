import { ConfigService } from '@nestjs/config';
import { AuthzModuleOptions } from '@svton/nestjs-authz';

export const useAuthzConfig = (
  configService: ConfigService,
): AuthzModuleOptions => ({
  // 权限配置
  roles: ['admin', 'user', 'guest'],
  defaultRole: 'guest',
});
