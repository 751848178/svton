import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/client/index.js';
import { DatabaseService } from '../database/database.service.js';
import type { RequestContext } from '../policy/request-context.js';
import type { ProjectPatch, ServiceMetadata } from './project-input.dto.js';

export const projectInclude = { targets: true, services: true } as const;
export type StoredProject = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

@Injectable()
export class ProjectRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  list(workspaceId: string): Promise<StoredProject[]> {
    return this.db.project.findMany({ where: { workspaceId }, include: projectInclude, orderBy: { createdAt: 'desc' } });
  }
  async get(id: string, workspaceId: string): Promise<StoredProject> {
    const project = await this.db.project.findFirst({ where: { id, workspaceId }, include: projectInclude });
    if (!project) throw new NotFoundException('项目不存在');
    return project;
  }
  async register(data: Prisma.ProjectCreateInput, context: RequestContext): Promise<StoredProject> {
    return this.db.$transaction(async (tx) => {
      const project = await tx.project.create({ data, include: projectInclude });
      await tx.audit.create({ data: { ...contextAudit(context), action: 'project.register', resourceType: 'project', resourceId: project.id, outcome: 'succeeded' } });
      return project;
    });
  }
  async patch(project: StoredProject, patch: ProjectPatch, context: RequestContext): Promise<StoredProject> {
    const targetKey = patch.targetKey ?? project.targetKey;
    return this.db.$transaction(async (tx) => {
      if (targetKey !== project.targetKey && await tx.task.findFirst({ where: { projectId: project.id, activeScope: { not: null } } })) {
        throw new ConflictException('运行中的项目不能切换发布目标');
      }
      await tx.project.update({ where: { id: project.id }, data: { name: patch.name, targetKey } });
      if (patch.serverName !== undefined) await tx.target.update({ where: { projectId_targetKey: { projectId: project.id, targetKey } }, data: { displayName: patch.serverName } });
      for (const service of patch.services ?? []) await tx.service.update({ where: { projectId_serviceKey: { projectId: project.id, serviceKey: service.serviceKey } }, data: fields(service) });
      await tx.audit.create({ data: { ...contextAudit(context), action: 'project.metadata', resourceType: 'project', resourceId: project.id, outcome: 'succeeded' } });
      return tx.project.findUniqueOrThrow({ where: { id: project.id }, include: projectInclude });
    });
  }
}

export function contextAudit(context: RequestContext): Pick<Prisma.AuditUncheckedCreateInput, 'actorId' | 'workspaceId' | 'requestId'> {
  return { actorId: context.actorId, workspaceId: context.workspaceId, requestId: context.requestId };
}
function fields(service: ServiceMetadata): { displayName?: string | null; entryUrl?: string | null } { return { displayName: service.displayName, entryUrl: service.entryUrl }; }
