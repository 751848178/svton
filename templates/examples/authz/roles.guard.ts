import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 获取装饰器设置的角色
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // TODO: 实际项目中从 JWT 或 Session 获取用户信息
    // 这里模拟用户信息
    if (!user) {
      // 模拟用户（实际应从认证中间件获取）
      request.user = {
        id: 1,
        name: 'Test User',
        role: 'admin', // 可以改为 'user', 'manager', 'guest' 测试不同角色
        permissions: ['user:update', 'user:delete', 'user:batch-delete', 'user:reset-password'],
      };
    }

    // 检查用户角色
    return requiredRoles.some((role) => user.role === role);
  }
}
