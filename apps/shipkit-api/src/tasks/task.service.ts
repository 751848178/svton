import { storedProjectInput } from '../projects/project-source.service.js';
import { BadRequestException, ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { PlatformExecutorService } from '../executor/platform-executor.service.js';
import type { ExecutionPlan, RemoteJobRef } from '../executor/executor.port.js';
import type { RequestContext } from '../policy/request-context.js';
import { ProjectService } from '../projects/project.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import { contextAudit } from '../projects/project.repository.js';
import { decodeJson, encodeJson } from '../transport/public-data.js';
import { executionError } from '../transport/execution-error.js';
import { TaskRepository } from './task.repository.js';
import { TaskRunnerService } from './task-runner.service.js';
import { TaskLogService } from './task-log.service.js';
import { TaskEventService } from './task-event.service.js';
import { eventView, planView, stageView, taskView } from './task.view.js';
import { PlanInputService } from './plan-input.service.js';

@Injectable()
export class TaskService {
  constructor(
    @Inject(TaskRepository) private readonly repository: TaskRepository,
    @Inject(TaskRunnerService) private readonly runner: TaskRunnerService,
    @Inject(TaskLogService) private readonly logs: TaskLogService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(PlatformExecutorService) private readonly executor: PlatformExecutorService,
    @Inject(LocalPolicyService) private readonly policy: LocalPolicyService,
    @Inject(TaskEventService) private readonly eventStore: TaskEventService,
    @Optional() @Inject(PlanInputService) private readonly inputs?: PlanInputService,
  ) {}
  async start(projectId: string, body: Record<string, unknown>, context: RequestContext): Promise<unknown> {
    const project = await this.projects.get(projectId, context);
    this.policy.authorize(context, 'task.start', project.workspaceId);
    if (typeof body.planId !== 'string') throw new BadRequestException('planId 必须明确指定');
    if (body.idempotencyKey !== undefined && (typeof body.idempotencyKey !== 'string' || !/^[a-zA-Z0-9._:-]{1,180}$/.test(body.idempotencyKey))) throw new BadRequestException('重复请求标识无效');
    const { task, created } = await this.repository.create(projectId, body.planId, body.idempotencyKey as string | undefined, context);
    if (created) this.runner.dispatch(task);
    return taskView(task);
  }
  async list(projectId: string, context: RequestContext): Promise<unknown> {
    await this.projects.get(projectId, context);
    return { items: (await this.repository.list(projectId)).map(taskView) };
  }
  async detail(id: string, context: RequestContext): Promise<unknown> {
    const task = await this.repository.get(id, context.workspaceId);
    this.policy.authorize(context, 'task.read', task.project.workspaceId);
    const [stages, events] = await Promise.all([
      this.repository.db.stage.findMany({ where: { taskId: id }, orderBy: [{ attempt: 'asc' }, { updatedAt: 'asc' }] }),
      this.repository.db.event.findMany({ where: { taskId: id }, orderBy: { seq: 'asc' }, take: 500 }),
    ]);
    return { task: taskView(task), plan: planView(task.plan, task.version), stages: stages.map(stageView), remoteJobs: task.remoteJobs, events: events.map(eventView) };
  }
  async events(id: string, after: number, context: RequestContext): Promise<unknown> {
    const task = await this.repository.get(id, context.workspaceId);
    this.policy.authorize(context, 'task.read', task.project.workspaceId);
    if (!Number.isSafeInteger(after) || after < 0) throw new BadRequestException('事件游标无效');
    const events = await this.repository.db.event.findMany({ where: { taskId: id, seq: { gt: after } }, orderBy: { seq: 'asc' }, take: 250 });
    return { events: events.map(eventView), nextSeq: events.at(-1)?.seq ?? after, complete: task.activeScope === null && task.cleanupState !== 'releasing' };
  }
  async log(id: string, stage: string, service: string | undefined, offset: number, context: RequestContext): Promise<unknown> {
    const task = await this.repository.get(id, context.workspaceId);
    this.policy.authorize(context, 'task.read', task.project.workspaceId);
    return this.logs.read(id, stage, service, offset);
  }
  async cancel(id: string, context: RequestContext): Promise<unknown> {
    const task = await this.repository.get(id, context.workspaceId);
    this.policy.authorize(context, 'task.cancel', task.project.workspaceId);
    return taskView(await this.repository.requestCancel(task, context));
  }
  async cleanup(id: string, context: RequestContext): Promise<unknown> {
    const task = await this.repository.get(id, context.workspaceId);
    this.policy.authorize(context, 'task.cleanup', task.project.workspaceId);
    if (task.activeScope) throw new ConflictException('任务仍在执行或等待远端确认，暂不能释放资源');
    const lease = await this.repository.db.resourceLease.findFirst({ where: { taskId: id, provider: { not: 'static' } }, orderBy: { updatedAt: 'desc' } });
    if (lease && await this.repository.db.resourceLease.findFirst({ where: { leaseRef: lease.leaseRef, task: { id: { not: id }, activeScope: { not: null } } } })) {
      throw new ConflictException('该构建机还有其他未确认任务，暂不能释放');
    }
    const acquired = await this.repository.db.task.updateMany({ where: { id, activeScope: null, cleanupState: { not: 'releasing' } }, data: { cleanupState: 'releasing' } });
    if (!acquired.count) throw new ConflictException('资源释放正在进行');
    const previous = await this.repository.db.stage.aggregate({ where: { taskId: id, stageKey: 'cleanup' }, _max: { attempt: true } });
    const attempt = (previous._max.attempt ?? 1) + 1;
    await this.eventStore.append(id, { type: 'stage', stageKey: 'cleanup', status: 'running', detail: { attempt } });
    await this.eventStore.append(id, { type: 'log', stageKey: 'cleanup', message: `开始第 ${attempt} 次资源释放` });
    let result: { cleanupState: string; output?: unknown };
    try {
      const input = this.inputs?.taskInput(task) ?? storedProjectInput(task.project, task.plan.targetKey);
      const plan = decodeJson(task.plan.snapshotJson) as ExecutionPlan;
      const hooks = { executionId: id, emit: (event: Parameters<TaskEventService['append']>[1]) => this.eventStore.append(id, event), isCancellationRequested: async () => false };
      await this.executor.archiveForCleanup(input, task.remoteJobs.map((job) => ({ ...job, serviceKey: job.serviceKey || undefined })) as RemoteJobRef[], hooks, plan, lease?.leaseRef);
      result = await this.executor.retryCleanup(input, plan, lease?.leaseRef) as typeof result;
    }
    catch (error) {
      const message = executionError(error);
      result = { cleanupState: 'failed', output: { error: message } };
      await this.eventStore.append(id, { type: 'log', stageKey: 'cleanup', message });
    }
    await this.eventStore.append(id, { type: 'cleanup', stageKey: 'cleanup', status: result.cleanupState, detail: { result: result.output } });
    await this.eventStore.append(id, { type: 'stage', stageKey: 'cleanup', status: result.cleanupState === 'failed' ? 'failed' : 'succeeded', detail: { attempt, result: result.output } });
    const updated = await this.repository.db.$transaction(async (tx) => {
      const value = await tx.task.update({ where: { id }, data: { cleanupState: result.cleanupState } });
      await tx.resourceLease.updateMany({ where: { taskId: id }, data: { status: result.cleanupState, detailJson: encodeJson(result.output ?? null) } });
      await tx.audit.create({ data: { ...contextAudit(context), action: 'task.cleanup', resourceType: 'task', resourceId: id, outcome: result.cleanupState } });
      await this.logs.finish(id, tx);
      return value;
    });
    return taskView(updated);
  }
}
