/** 日志域工具 - 重连延迟、数值钳制、时间线合并与展示格式化。 */

import type { LogEntry, LogStream, LogStreamSession, LogCollectionRun } from './types-stream';
import { streamReconnectDelaysMs } from './constants';

export function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

export function getStreamReconnectDelayMs(attempt: number) {
  const index = Math.max(0, Math.min(attempt - 1, streamReconnectDelaysMs.length - 1));
  return streamReconnectDelaysMs[index];
}

export function mergeLogTimeline(current: LogEntry[], incoming: LogEntry[]) {
  const entriesById = new Map<string, LogEntry>();
  current.forEach((entry) => entriesById.set(entry.id, entry));
  incoming.forEach((entry) => entriesById.set(entry.id, entry));
  return Array.from(entriesById.values())
    .sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime() ||
        left.id.localeCompare(right.id),
    )
    .slice(-200);
}

export function mergeStreamSessions(
  current: LogStreamSession[],
  incoming: LogStreamSession[],
  streamId?: string,
) {
  const sessionsById = new Map<string, LogStreamSession>();
  current
    .filter((session) => !streamId || session.streamId !== streamId)
    .forEach((session) => sessionsById.set(session.id, session));
  incoming.forEach((session) => sessionsById.set(session.id, session));
  return Array.from(sessionsById.values()).sort(
    (left, right) => new Date(right.lastEventAt).getTime() - new Date(left.lastEventAt).getTime(),
  );
}

export function formatStreamTarget(stream: LogStream) {
  return (
    stream.applicationService?.name ||
    stream.server?.name ||
    stream.site?.name ||
    stream.managedResource?.name ||
    stream.backupPlan?.name ||
    stream.backupRun?.id ||
    stream.alertEvent?.metric ||
    stream.deploymentRun?.id ||
    stream.project?.name ||
    '未绑定目标'
  );
}

export function formatEntryTarget(entry: LogEntry) {
  return (
    entry.applicationService?.name ||
    entry.server?.name ||
    entry.site?.name ||
    entry.managedResource?.name ||
    entry.project?.name ||
    entry.stream?.name ||
    '-'
  );
}

export function formatRunTarget(run: LogCollectionRun) {
  return (
    run.stream?.name ||
    run.server?.name ||
    run.managedResource?.name ||
    run.sourceKey ||
    run.sourceType
  );
}

export function formatRunStatus(status: string) {
  const labels: Record<string, string> = {
    queued: '已入队',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    blocked: '已阻断',
    cancelled: '已取消',
  };
  return labels[status] || status;
}

export function formatSessionStatus(status: string) {
  const labels: Record<string, string> = {
    open: '在线',
    closing: '关闭中',
  };
  return labels[status] || status;
}

export function formatIngestionStatus(status: string) {
  const labels: Record<string, string> = {
    completed: '完成',
    skipped: '跳过',
    failed: '失败',
    pending: '等待',
  };
  return labels[status] || status;
}

/** 日期时间格式化（带秒，统一走共享 util）。 */
export { formatDateTime as formatDate } from '@/lib/format-date';

export function shortId(value: string) {
  return value.slice(0, 8);
}
