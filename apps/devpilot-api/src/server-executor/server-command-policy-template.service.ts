import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CreateServerCommandPolicyTemplateDto,
  ListServerCommandPolicyTemplatesQueryDto,
  UpdateServerCommandPolicyTemplateDto,
} from "./dto/server-command-policy-template.dto";
import {
  commandPolicyPatternKind,
  isValidCommandPolicyPattern,
} from "./server-command-policy-pattern.utils";
import {
  cleanStringList,
  matchesStringList,
  toStringListJson,
} from "./server-command-policy-string-list.utils";
import { ServerCommandPolicyTemplateRepository } from "./server-command-policy-template.repository";

@Injectable()
export class ServerCommandPolicyTemplateService {
  constructor(
    private readonly repository: ServerCommandPolicyTemplateRepository,
  ) {}

  async listTemplates(
    teamId: string,
    query: ListServerCommandPolicyTemplatesQueryDto,
  ) {
    const templates = await this.repository.list(teamId, {
      projectId: query.projectId,
      environmentId: query.environmentId,
      enabled:
        query.enabled === "true" || query.enabled === "false"
          ? query.enabled
          : undefined,
    });
    return templates.filter(
      (template) =>
        matchesStringList(template.adapterKeys, query.adapterKey) &&
        matchesStringList(template.operationKeys, query.operationKey),
    );
  }

  async createTemplate(
    teamId: string,
    userId: string,
    dto: CreateServerCommandPolicyTemplateDto,
  ) {
    await this.assertTemplateBindings(teamId, dto.projectId, dto.environmentId);
    this.assertPatterns(dto.allowedPatterns || []);
    this.assertPatterns(dto.blockedPatterns || []);

    return this.repository.create({
      teamId,
      createdById: userId,
      name: dto.name,
      description: dto.description,
      projectId: dto.projectId || undefined,
      environmentId: dto.environmentId || undefined,
      enabled: dto.enabled ?? true,
      priority: dto.priority ?? 0,
      adapterKeys: toStringListJson(dto.adapterKeys),
      operationKeys: toStringListJson(dto.operationKeys),
      allowedPatterns: toStringListJson(dto.allowedPatterns),
      blockedPatterns: toStringListJson(dto.blockedPatterns),
    });
  }

  async getTemplateAccessScope(teamId: string, id: string) {
    const template = await this.repository.findAccessScope(teamId, id);
    if (!template) {
      throw new NotFoundException("Server executor 命令策略模板不存在");
    }
    return {
      projectId: template.projectId,
      environmentId: template.environmentId,
    };
  }

  async updateTemplate(
    teamId: string,
    id: string,
    dto: UpdateServerCommandPolicyTemplateDto,
  ) {
    const existing = await this.repository.findByTeam(teamId, id);
    if (!existing) {
      throw new NotFoundException("Server executor 命令策略模板不存在");
    }

    const nextProjectId =
      dto.projectId !== undefined
        ? dto.projectId || undefined
        : existing.projectId || undefined;
    const nextEnvironmentId =
      dto.environmentId !== undefined
        ? dto.environmentId || undefined
        : existing.environmentId || undefined;
    await this.assertTemplateBindings(teamId, nextProjectId, nextEnvironmentId);
    if (dto.allowedPatterns) this.assertPatterns(dto.allowedPatterns);
    if (dto.blockedPatterns) this.assertPatterns(dto.blockedPatterns);

    const data: Prisma.ServerCommandPolicyTemplateUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.projectId !== undefined)
      data.project = dto.projectId
        ? { connect: { id: dto.projectId } }
        : { disconnect: true };
    if (dto.environmentId !== undefined)
      data.environment = dto.environmentId
        ? { connect: { id: dto.environmentId } }
        : { disconnect: true };
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.adapterKeys !== undefined)
      data.adapterKeys = toStringListJson(dto.adapterKeys);
    if (dto.operationKeys !== undefined)
      data.operationKeys = toStringListJson(dto.operationKeys);
    if (dto.allowedPatterns !== undefined)
      data.allowedPatterns = toStringListJson(dto.allowedPatterns);
    if (dto.blockedPatterns !== undefined)
      data.blockedPatterns = toStringListJson(dto.blockedPatterns);

    return this.repository.update(id, data);
  }

  async deleteTemplate(teamId: string, id: string) {
    const existing = await this.repository.findByTeam(teamId, id);
    if (!existing) {
      throw new NotFoundException("Server executor 命令策略模板不存在");
    }
    return this.repository.delete(id);
  }

  private async assertTemplateBindings(
    teamId: string,
    projectId?: string | null,
    environmentId?: string | null,
  ) {
    if (projectId && !(await this.repository.findProject(teamId, projectId))) {
      throw new NotFoundException("项目不存在或不属于当前团队");
    }

    if (!environmentId) return;

    const environment = await this.repository.findActiveEnvironment(
      teamId,
      environmentId,
    );
    if (!environment) {
      throw new NotFoundException("项目环境不存在或不属于当前团队");
    }
    if (projectId && environment.projectId !== projectId) {
      throw new BadRequestException("项目环境必须属于所选项目");
    }
  }

  private assertPatterns(patterns: string[]) {
    for (const pattern of cleanStringList(patterns)) {
      if (!isValidCommandPolicyPattern(pattern)) {
        throw new BadRequestException(
          `命令策略模板包含无效${commandPolicyPatternKind(pattern)}模式: ${pattern}`,
        );
      }
    }
  }
}
