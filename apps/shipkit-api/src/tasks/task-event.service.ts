import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/client/index.js';
import { DatabaseService } from '../database/database.service.js';
import type { ExecutionEvent } from '../executor/executor.port.js';
import { encodeJson, publicData } from '../transport/public-data.js';
import { TaskLogService } from './task-log.service.js';

@Injectable()
export class TaskEventService {
  private readonly queues = new Map<string, Promise<void>>();
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService, @Inject(TaskLogService) private readonly logs: TaskLogService) {}
  append(taskId: string, event: ExecutionEvent): Promise<void> {
    const previous = this.queues.get(taskId) ?? Promise.resolve();
    const next = previous.then(() => this.persist(taskId, publicData(event)));
    this.queues.set(taskId, next);
    void next.finally(() => { if (this.queues.get(taskId) === next) this.queues.delete(taskId); }).catch(() => undefined);
    return next;
  }
  private async persist(taskId: string, event: ExecutionEvent): Promise<void> {
    const stageKey = event.stageKey ?? 'deploy';
    let logBytes: number | undefined;
    if (event.type === 'log' && event.message) logBytes = await this.logs.append(taskId, stageKey, event.serviceKey, event.message);
    const payload = event.type === 'log' ? { ...event, message: undefined, logBytes } : event;
    await this.db.$transaction(async (tx) => {
      const last = await tx.event.aggregate({ where: { taskId }, _max: { seq: true } });
      await tx.event.create({ data: { taskId, seq: (last._max.seq ?? 0) + 1, type: event.type, stageKey: event.stageKey, serviceKey: event.serviceKey, payloadJson: encodeJson(payload) } });
      const update: Prisma.TaskUpdateInput = {};
      if (event.type === 'stage' && event.stageKey && event.status) {
        update.phase = event.stageKey;
        const attempt = typeof event.detail?.attempt === 'number' && Number.isSafeInteger(event.detail.attempt) && event.detail.attempt > 0 ? event.detail.attempt : 1;
        const key = { taskId, stageKey: event.stageKey, serviceKey: event.serviceKey ?? '', attempt };
        await tx.stage.upsert({ where: { taskId_stageKey_serviceKey_attempt: key }, create: { ...key, status: event.status, detailJson: encodeJson(event.detail ?? {}) }, update: { status: event.status, detailJson: encodeJson(event.detail ?? {}) } });
      }
      if (event.remoteJob) {
        const ref = event.remoteJob;
        const key = { taskId, urlRef: ref.urlRef, jobId: ref.jobId };
        const value = { stageKey: ref.stageKey, serviceKey: ref.serviceKey ?? '', agentRole: ref.agentRole, status: ref.status ?? 'running', logOffset: ref.logOffset, eventOffset: ref.eventOffset };
        await tx.remoteJob.upsert({ where: { taskId_urlRef_jobId: key }, create: { ...key, ...value }, update: value });
      }
      if (event.type === 'cleanup' && event.status) {
        update.cleanupState = event.status;
        await tx.resourceLease.updateMany({ where: { taskId }, data: { status: event.status, detailJson: encodeJson(event.detail ?? {}) } });
        const { provider, leaseRef } = event.detail ?? {};
        if (typeof provider === 'string' && typeof leaseRef === 'string') {
          const key = { taskId, provider, leaseRef };
          await tx.resourceLease.upsert({ where: { taskId_provider_leaseRef: key }, create: { ...key, status: event.status, detailJson: encodeJson(event.detail) }, update: { status: event.status, detailJson: encodeJson(event.detail) } });
        }
      }
      if (event.type === 'stage' && event.stageKey === 'provision' && event.status === 'succeeded') {
        const { provider, leaseRef } = event.detail ?? {};
        if (typeof provider === 'string' && provider !== 'static' && typeof leaseRef === 'string') {
          const key = { taskId, provider, leaseRef };
          await tx.resourceLease.upsert({ where: { taskId_provider_leaseRef: key }, create: { ...key, status: 'active', detailJson: encodeJson(event.detail) }, update: { status: 'active', detailJson: encodeJson(event.detail) } });
        }
      }
      if (event.type === 'recovery' && event.status) update.recoveryState = event.status;
      if (event.type === 'cancel' || event.detail?.cancellable !== undefined) {
        const current = await tx.task.findUniqueOrThrow({ where: { id: taskId } });
        if (current.activeScope) {
          if (event.type === 'cancel' && event.status && !(current.cancelState === 'requested' && ['available', 'none', 'noncancellable'].includes(event.status))) update.cancelState = event.status;
          if (event.detail?.cancellable !== undefined && !['requested', 'cancelling', 'cancelled'].includes(current.cancelState)) update.cancelState = event.detail.cancellable === false ? 'noncancellable' : 'none';
        }
      }
      if (Object.keys(update).length) await tx.task.update({ where: { id: taskId }, data: update });
    });
  }
}
