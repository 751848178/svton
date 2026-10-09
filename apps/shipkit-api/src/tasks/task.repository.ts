import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Plan, Prisma, Task } from '../../generated/client/index.js';
import { DatabaseService } from '../database/database.service.js';
import type { RequestContext } from '../policy/request-context.js';
import { contextAudit } from '../projects/project.repository.js';
import { allocateTaskVersion } from './task-version.repository.js';
import { versionConflict } from './release-version.js';

export const taskInclude = { plan: true, project: true, remoteJobs: true } as const;
export type StoredTask = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
const STAGES = ['provision', 'build', 'push', 'cleanup', 'deploy', 'verify'];

@Injectable()
export class TaskRepository {
  constructor(@Inject(DatabaseService) readonly db: DatabaseService) {}
  async get(id: string, workspaceId = 'local'): Promise<StoredTask> {
    const task = await this.db.task.findFirst({ where: { id, project: { workspaceId } }, include: taskInclude });
    if (!task) throw new NotFoundException('发布任务不存在');
    return task;
  }
  list(projectId: string): Promise<Array<Task & { plan: Plan }>> { return this.db.task.findMany({ where: { projectId }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 100 }); }
  async create(projectId: string, planId: string, idempotencyKey: string | undefined, context: RequestContext): Promise<{ task: StoredTask; created: boolean }> {
    const key = idempotencyKey ? `${context.workspaceId}:${projectId}:${idempotencyKey}` : null;
    try {
      return await this.db.$transaction(async (tx) => {
        if (key) {
          const existing = await tx.task.findUnique({ where: { idempotencyKey: key }, include: taskInclude });
          if (existing) {
            if (existing.planId !== planId) throw new ConflictException('重复请求键已用于不同计划');
            return { task: existing, created: false };
          }
        }
        const plan = await tx.plan.findFirst({ where: { id: planId, projectId, project: { workspaceId: context.workspaceId } }, include: { project: true } });
        if (!plan) throw new NotFoundException('发布计划不存在');
        if (plan.expiresAt.getTime() <= Date.now()) throw new ConflictException({ code: 'PLAN_EXPIRED', message: '发布计划已过期，请重新核对' });
        const previous = await tx.task.findFirst({ where: { projectId, activeScope: null, cleanupState: { in: ['failed', 'releasing', 'pending', 'unknown'] } } });
        if (previous) throw new ConflictException('项目存在待处理临时资源，请先重试释放');
        const snapshot = JSON.parse(plan.snapshotJson) as { detail?: { projectIdentity?: string; sourceSnapshot?: { sourceRevision?: number | string } } };
        if (plan.project.sourceKind === 'repository' && plan.kind === 'release' && snapshot.detail?.sourceSnapshot?.sourceRevision !== plan.project.sourceRevision) {
          throw new ConflictException('仓库设置已变化，请重新核对计划');
        }
        const identity = snapshot.detail?.projectIdentity ?? plan.project.projectIdentity;
        const version = await allocateTaskVersion(tx, projectId, plan.version);
        const task = await tx.task.create({ data: {
          projectId, planId, kind: plan.kind, version, actorId: context.actorId, idempotencyKey: key,
          activeScope: `${context.workspaceId}:${identity}:${plan.targetKey}`,
          stages: { create: STAGES.map((stageKey) => ({ stageKey })) },
        }, include: taskInclude });
        await tx.audit.create({ data: { ...contextAudit(context), action: 'task.start', resourceType: 'task', resourceId: task.id, outcome: 'queued' } });
        return { task, created: true };
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        if ((JSON.stringify((error as { meta?: unknown }).meta) ?? '').includes('version')) throw versionConflict();
        throw new ConflictException('该项目目标已有运行中的发布');
      }
      throw error;
    }
  }
  async requestCancel(task: StoredTask, context: RequestContext): Promise<Task> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.task.findUniqueOrThrow({ where: { id: task.id } });
      if (!current.activeScope || !['queued', 'running', 'cancel-requested', 'interrupted'].includes(current.status)) return current;
      if (current.cancelState === 'noncancellable') throw new ConflictException('发布正在提交，当前临界区不能取消');
      const result = await tx.task.update({ where: { id: task.id }, data: { status: 'cancel-requested', cancelState: 'requested' } });
      await tx.audit.create({ data: { ...contextAudit(context), action: 'task.cancel', resourceType: 'task', resourceId: task.id, outcome: 'requested' } });
      return result;
    });
  }
}
