import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { ExecutionOutcome } from 'shipkit/platform';
import { PlatformExecutorService } from '../executor/platform-executor.service.js';
import type { ExecutionHooks, ExecutionPlan, RemoteJobRef } from '../executor/executor.port.js';
import { decodeJson, encodeJson } from '../transport/public-data.js';
import { executionError } from '../transport/execution-error.js';
import { TaskRepository, type StoredTask } from './task.repository.js';
import { TaskEventService } from './task-event.service.js';
import { TaskLogService } from './task-log.service.js';
import { finalizeStages } from './stage-finalization.repository.js';

@Injectable()
export class TaskRunnerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly running = new Set<string>();
  private timer?: NodeJS.Timeout;
  constructor(
    @Inject(TaskRepository) private readonly repository: TaskRepository,
    @Inject(PlatformExecutorService) private readonly executor: PlatformExecutorService,
    @Inject(TaskEventService) private readonly events: TaskEventService,
    @Inject(TaskLogService) private readonly logs: TaskLogService,
  ) {}
  onApplicationBootstrap(): void {
    void this.reconcile().catch(() => undefined);
    this.timer = setInterval(() => { void this.reconcile().catch(() => undefined); }, 10_000);
    this.timer.unref();
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }
  dispatch(task: StoredTask): void { void this.run(task, false).catch(() => undefined); }
  private hooks(taskId: string): ExecutionHooks {
    return {
      executionId: taskId,
      emit: (event) => this.events.append(taskId, event),
      isCancellationRequested: async () => {
        const task = await this.repository.db.task.findUniqueOrThrow({ where: { id: taskId } });
        return task.status === 'cancel-requested' || ['requested', 'cancelling'].includes(task.cancelState);
      },
    };
  }
  private async reconcile(): Promise<void> {
    const tasks = await this.repository.db.task.findMany({ where: { activeScope: { not: null } }, include: { plan: true, project: true, remoteJobs: true } });
    await Promise.allSettled(tasks.filter((task) => !this.running.has(task.id)).map((task) => this.run(task, true)));
  }
  private async run(task: StoredTask, reconcile: boolean): Promise<void> {
    if (this.running.has(task.id)) return;
    this.running.add(task.id);
    const hooks = this.hooks(task.id);
    const input = { ...task.project, targetKey: task.plan.targetKey };
    try {
      if (!reconcile) await this.repository.db.task.update({ where: { id: task.id }, data: { status: task.status === 'cancel-requested' ? task.status : 'running', startedAt: new Date() } });
      const result = reconcile
        ? await this.executor.reconcileTask(input, task.remoteJobs.map((job) => ({ ...job, stageKey: job.stageKey, serviceKey: job.serviceKey || undefined })) as RemoteJobRef[], hooks)
        : await this.executor.executeTask(input, decodeJson(task.plan.snapshotJson) as ExecutionPlan, hooks);
      await this.finish(task, result);
    } catch (error) {
      const message = executionError(error);
      await this.events.append(task.id, { type: 'diagnostic', message }).catch(() => undefined);
      // Unknown remote completion remains gated. A fresh execution error with no
      // remote mapping is safe to finish; an observed job requires reconciliation.
      const [jobs, intents, current] = await Promise.all([
        this.repository.db.remoteJob.count({ where: { taskId: task.id } }),
        this.repository.db.event.count({ where: { taskId: task.id, type: 'remote-intent' } }),
        this.repository.db.task.findUniqueOrThrow({ where: { id: task.id } }),
      ]);
      await this.finish(task, { status: jobs || intents || reconcile ? 'interrupted' : 'failed', error: message, cleanupState: current.cleanupState, recoveryState: current.recoveryState });
    } finally { this.running.delete(task.id); }
  }
  private async finish(task: StoredTask, outcome: ExecutionOutcome): Promise<void> {
    const safe = outcome.status !== 'interrupted' || (outcome.output as { safeToReleaseGate?: boolean } | undefined)?.safeToReleaseGate === true;
    await this.repository.db.$transaction(async (tx) => {
      await tx.task.update({ where: { id: task.id }, data: {
        status: outcome.status, activeScope: safe ? null : task.activeScope,
        finishedAt: safe ? new Date() : null, error: outcome.error ? executionError(outcome.error) : null, outputJson: encodeJson(outcome.output ?? null),
        cleanupState: outcome.cleanupState, recoveryState: outcome.recoveryState,
        remoteReleaseId: outcome.remoteReleaseId, previousReleaseId: outcome.previousReleaseId,
        ...(outcome.status === 'cancelled' ? { cancelState: 'cancelled' } : {}),
      } });
      await tx.audit.create({ data: { workspaceId: task.project.workspaceId, actorId: task.actorId, requestId: `task:${task.id}`, action: 'task.outcome', resourceType: 'task', resourceId: task.id, outcome: outcome.status } });
      if (safe) {
        await this.logs.finish(task.id, tx);
        await finalizeStages(tx, task.id, outcome.status);
      }
    });
  }
}
