import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TeamService } from '../team.service';
import { MemberRole } from '../dto/team.dto';

export const TEAM_ROLES_KEY = 'teamRoles';

// 装饰器：指定需要的团队角色
export const TeamRoles = (...roles: MemberRole[]) => {
  return (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata(TEAM_ROLES_KEY, roles, descriptor?.value || target);
    return descriptor;
  };
};

@Injectable()
export class TeamGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly teamService: TeamService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('未登录');
    }

    // 从请求中获取 teamId（可以从 params、query 或 body 中获取）
    const teamId =
      request.params?.teamId ||
      request.query?.teamId ||
      request.body?.teamId ||
      request.headers['x-team-id'];

    if (!teamId) {
      throw new ForbiddenException('缺少团队 ID');
    }

    // 检查用户是否是团队成员
    const role = await this.teamService.getMemberRole(teamId, user.id);

    if (!role) {
      throw new ForbiddenException('无权访问该团队');
    }

    // 获取需要的角色
    const requiredRoles = this.reflector.get<MemberRole[]>(
      TEAM_ROLES_KEY,
      context.getHandler(),
    );

    // 如果没有指定角色要求，只要是成员就可以
    if (!requiredRoles || requiredRoles.length === 0) {
      request.teamId = teamId;
      request.teamRole = role;
      return true;
    }

    // 检查角色权限
    if (!requiredRoles.includes(role as MemberRole)) {
      throw new ForbiddenException('权限不足');
    }

    // 将团队信息附加到请求对象
    request.teamId = teamId;
    request.teamRole = role;

    return true;
  }
}
