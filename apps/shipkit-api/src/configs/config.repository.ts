import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ConfigDraft, ConfigVersion, Prisma } from '../../generated/client/index.js';
import { DatabaseService } from '../database/database.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import type { RequestContext } from '../policy/request-context.js';

@Injectable()
export class ConfigRepository {
  constructor(@Inject(DatabaseService) readonly db: DatabaseService, @Inject(LocalPolicyService) private readonly policy: LocalPolicyService) {}
  async scope(projectId: string, targetKey: string, context: RequestContext, action: string): Promise<string[]> {
    const project = await this.db.project.findFirst({ where: { id: projectId, workspaceId: context.workspaceId }, include: { targets: true, services: true } });
    if (!project) throw new NotFoundException('项目不存在');
    this.policy.authorize(context, action, project.workspaceId);
    if (!project.targets.some((target) => target.targetKey === targetKey)) throw new BadRequestException('环境未在项目中注册');
    return project.services.map((service) => service.serviceKey);
  }
  async draft(projectId: string, targetKey: string, id: string): Promise<ConfigDraft> {
    const row = await this.db.configDraft.findFirst({ where: { id, projectId, targetKey } });
    if (!row) throw new NotFoundException('配置草稿不存在');
    return row;
  }
  async version(projectId: string, targetKey: string, id: string): Promise<ConfigVersion> {
    const row = await this.db.configVersion.findFirst({ where: { id, projectId, targetKey } });
    if (!row) throw new NotFoundException('配置版本不存在');
    return row;
  }
  knownVersions(projectId: string, targetKey: string, ids: string[]): Promise<ConfigVersion[]> {
    return this.db.configVersion.findMany({ where: { projectId, targetKey, id: { in: ids } } });
  }
  async create(data: Prisma.ConfigDraftUncheckedCreateInput, context: RequestContext): Promise<ConfigDraft> {
    return this.db.$transaction(async (tx) => {
      const row = await tx.configDraft.create({ data });
      await this.audit(tx, context, 'config.create', row.id, 'draft');
      return row;
    });
  }
  async update(row: ConfigDraft, data: { name?: string; servicesJson: string }, context: RequestContext): Promise<ConfigDraft> {
    return this.db.$transaction(async (tx) => {
      const changed = await tx.configDraft.updateMany({ where: { id: row.id, etag: row.etag, status: 'draft' }, data: { ...data, etag: row.etag + 1, actorId: context.actorId } });
      if (!changed.count) throw new ConflictException('草稿已改变或冻结，请刷新后编辑');
      await this.audit(tx, context, 'config.update', row.id, 'draft');
      return tx.configDraft.findUniqueOrThrow({ where: { id: row.id } });
    });
  }
  async freeze(draft: ConfigDraft, data: Prisma.ConfigVersionUncheckedCreateInput, context: RequestContext): Promise<ConfigVersion> {
    try {
      return await this.db.$transaction(async (tx) => {
        const changed = await tx.configDraft.updateMany({ where: { id: draft.id, etag: draft.etag, status: 'draft' }, data: { status: 'frozen', actorId: context.actorId } });
        if (!changed.count) throw new ConflictException('草稿已改变或冻结，请刷新后核对');
        const row = await tx.configVersion.create({ data });
        await this.audit(tx, context, 'config.freeze', row.id, 'frozen');
        return row;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('该环境的配置版本号已经存在');
      throw error;
    }
  }
  async archive(row: ConfigVersion, context: RequestContext): Promise<ConfigVersion> {
    return this.db.$transaction(async (tx) => {
      await tx.configVersion.updateMany({ where: { id: row.id, archivedAt: null }, data: { archivedAt: new Date() } });
      await this.audit(tx, context, 'config.archive', row.id, 'archived');
      return tx.configVersion.findUniqueOrThrow({ where: { id: row.id } });
    });
  }
  private async audit(tx: Prisma.TransactionClient, context: RequestContext, action: string, id: string, outcome: string): Promise<void> {
    await tx.audit.create({ data: { actorId: context.actorId, workspaceId: context.workspaceId, requestId: context.requestId, action, resourceType: 'config', resourceId: id, outcome } });
  }
}
