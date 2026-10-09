import type { Event, Plan, Stage, Task } from '../../generated/client/index.js';
import { decodeJson, publicData } from '../transport/public-data.js';

export function taskView(task: Task & { plan?: Plan }): Record<string, unknown> {
  return publicData({
    id: task.id, version: task.version, projectId: task.projectId, planId: task.planId, kind: task.kind, status: task.status,
    phase: task.phase, cancelState: task.cancelState, recoveryState: task.recoveryState, cleanupState: task.cleanupState,
    remoteReleaseId: task.remoteReleaseId, previousReleaseId: task.previousReleaseId, error: task.error,
    output: decodeJson(task.outputJson), createdAt: task.createdAt, startedAt: task.startedAt, finishedAt: task.finishedAt,
    ...(task.plan ? { selection: decodeJson(task.plan.selectionJson) } : {}),
  });
}
export function planView(plan: Plan, taskVersion?: string): Record<string, unknown> {
  const snapshot = decodeJson(plan.snapshotJson) as { detail: unknown; sourceMode: string; keepEnv: boolean; keepBuilder: boolean; configMode?: string; configBindings?: unknown };
  return { id: plan.id, version: taskVersion ?? plan.version, kind: plan.kind, baseReleaseId: plan.baseReleaseId, selection: decodeJson(plan.selectionJson), expiresAt: plan.expiresAt, detail: snapshot.detail, sourceMode: snapshot.sourceMode, keepEnv: snapshot.keepEnv, keepBuilder: snapshot.keepBuilder,
    configMode: snapshot.configMode, configVersionId: plan.configVersionId, configBindings: snapshot.configBindings };
}
export function stageView(stage: Stage): Record<string, unknown> {
  return { stageKey: stage.stageKey, serviceKey: stage.serviceKey || null, attempt: stage.attempt, status: stage.status, detail: decodeJson(stage.detailJson), updatedAt: stage.updatedAt };
}
export function eventView(event: Event): Record<string, unknown> {
  return { ...(decodeJson(event.payloadJson) as object), seq: event.seq, createdAt: event.createdAt };
}
