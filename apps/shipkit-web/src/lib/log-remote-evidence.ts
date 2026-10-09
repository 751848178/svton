import type { RemoteJob, TaskEvent } from './contracts';
import { object } from './presentation';

export interface RemoteJobEvidence extends RemoteJob { updatedAt?: string; logOffset?: number; eventOffset?: number }
export function remoteJobEvidence(job: RemoteJob, events: TaskEvent[]): RemoteJobEvidence {
  const matching = events.filter(event => event.remoteJob?.jobId === job.jobId || object(event.detail).jobId === job.jobId);
  const latest = [...matching].reverse().find(event => event.remoteJob);
  const stored: RemoteJobEvidence = job;
  const snapshot = object(latest?.remoteJob);
  return { ...stored, updatedAt: stored.updatedAt || matching[matching.length - 1]?.createdAt,
    logOffset: stored.logOffset ?? (typeof snapshot.logOffset === 'number' ? snapshot.logOffset : undefined),
    eventOffset: stored.eventOffset ?? (typeof snapshot.eventOffset === 'number' ? snapshot.eventOffset : undefined) };
}
const categories: Record<string, { label: string; description: string }> = {
  stage: { label: '阶段状态变化', description: '开始、完成或失败等状态记录' },
  log: { label: '日志归档更新', description: '日志读取游标；正文已在上方展示' },
  'remote-job': { label: '远端任务轮询', description: '用于同步状态和归档进度' },
  'remote-event': { label: '远端生命周期事件', description: '远端执行阶段和结果的事件' },
  'remote-intent': { label: '远端执行请求', description: '创建远端任务前的意图记录' },
  cancel: { label: '取消能力与响应', description: '安全取消条件及请求响应' },
  cleanup: { label: '资源清理', description: '构建资源释放状态' },
  recovery: { label: '版本恢复', description: '恢复操作及结果' },
};
export function eventCategories(events: TaskEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.type, (counts.get(event.type) || 0) + 1);
  return [...counts].map(([type, count]) => ({ type, count, ...(categories[type] || { label: type, description: '其他已载入事件' }) }));
}
