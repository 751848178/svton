import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateControlAccessPolicyDto,
  ListControlAccessPoliciesQueryDto,
  UpdateControlAccessPolicyDto,
} from "./dto/control-access-policy.dto";
import { ControlAccessPolicyAuditService } from "./control-access-policy-audit.service";
import { matchesStringList } from "./control-access-policy-match.utils";
import { ControlAccessPolicyRepository } from "./control-access-policy.repository";

@Injectable()
export class ControlAccessPolicyCrudService {
  constructor(
    private readonly policyRepository: ControlAccessPolicyRepository,
    private readonly policyAuditService: ControlAccessPolicyAuditService,
  ) {}

  async list(teamId: string, query: ListControlAccessPoliciesQueryDto) {
    const policies = await this.policyRepository.list(teamId, query);
    return policies.filter(
      (policy) =>
        matchesStringList(policy.categories, query.category) &&
        matchesStringList(policy.actions, query.action) &&
        matchesStringList(policy.riskLevels, query.risk),
    );
  }

  async create(
    teamId: string,
    userId: string,
    dto: CreateControlAccessPolicyDto,
  ) {
    await this.assertBindings(
      teamId,
      dto.projectId,
      dto.environmentId,
      dto.principalUserId,
    );
    this.assertPrincipal(
      dto.principalType || "team_role",
      dto.principalRole,
      dto.principalUserId,
    );

    const policy = await this.policyRepository.create(teamId, userId, dto);
    await this.policyAuditService.writePolicyAudit(
      policy,
      userId,
      "access_policy.created",
      "completed",
    );
    return policy;
  }

  async update(
    teamId: string,
    userId: string,
    id: string,
    dto: UpdateControlAccessPolicyDto,
  ) {
    const existing = await this.policyRepository.findByIdForTeam(teamId, id);
    if (!existing) throw new NotFoundException("控制面访问策略不存在");

    const nextProjectId =
      dto.projectId !== undefined
        ? dto.projectId || undefined
        : existing.projectId || undefined;
    const nextEnvironmentId =
      dto.environmentId !== undefined
        ? dto.environmentId || undefined
        : existing.environmentId || undefined;
    const nextPrincipalUserId =
      dto.principalUserId !== undefined
        ? dto.principalUserId || undefined
        : existing.principalUserId || undefined;
    const nextPrincipalType = dto.principalType || existing.principalType;
    const nextPrincipalRole =
      dto.principalRole !== undefined
        ? dto.principalRole || undefined
        : existing.principalRole || undefined;

    await this.assertBindings(
      teamId,
      nextProjectId,
      nextEnvironmentId,
      nextPrincipalUserId,
    );
    this.assertPrincipal(
      nextPrincipalType,
      nextPrincipalRole,
      nextPrincipalUserId,
    );

    const policy = await this.policyRepository.update(id, dto);
    await this.policyAuditService.writePolicyAudit(
      policy,
      userId,
      "access_policy.updated",
      "completed",
    );
    return policy;
  }

  async delete(teamId: string, userId: string, id: string) {
    const existing = await this.policyRepository.findByIdForTeam(teamId, id);
    if (!existing) throw new NotFoundException("控制面访问策略不存在");

    await this.policyRepository.delete(id);
    await this.policyAuditService.writePolicyAudit(
      existing,
      userId,
      "access_policy.deleted",
      "completed",
    );
    return { deleted: true };
  }

  private async assertBindings(
    teamId: string,
    projectId?: string | null,
    environmentId?: string | null,
    principalUserId?: string | null,
  ) {
    if (projectId) {
      const project = await this.policyRepository.findProject(
        teamId,
        projectId,
      );
      if (!project) throw new NotFoundException("项目不存在或不属于当前团队");
    }

    if (environmentId) {
      const environment = await this.policyRepository.findEnvironment(
        teamId,
        environmentId,
      );
      if (!environment)
        throw new NotFoundException("项目环境不存在或不属于当前团队");
      if (projectId && environment.projectId !== projectId) {
        throw new BadRequestException("项目环境必须属于所选项目");
      }
    }

    if (principalUserId) {
      const membership = await this.policyRepository.findTeamMember(
        teamId,
        principalUserId,
      );
      if (!membership) throw new NotFoundException("授权用户不是当前团队成员");
    }
  }

  private assertPrincipal(
    principalType: string,
    principalRole?: string | null,
    principalUserId?: string | null,
  ) {
    if (!["team_role", "user", "any"].includes(principalType)) {
      throw new BadRequestException("无效授权主体类型");
    }
    if (
      principalRole &&
      !["owner", "admin", "member"].includes(principalRole)
    ) {
      throw new BadRequestException("无效团队角色");
    }
    if (principalType === "user" && !principalUserId) {
      throw new BadRequestException("用户级策略必须选择授权用户");
    }
    if (principalType === "team_role" && !principalRole) {
      throw new BadRequestException("团队角色策略必须选择角色");
    }
  }
}
