import type { Stage, StageKey, Task } from './contracts';

export function stageState(stages: Stage[], key: StageKey) {
  const latest = new Map<string, Stage>();
  for (const stage of stages.filter(value => value.stageKey === key)) {
    const identity = stage.serviceKey || '';
    const previous = latest.get(identity);
    if (!previous || (stage.attempt ?? 1) >= (previous.attempt ?? 1)) latest.set(identity, stage);
  }
  const matching = [...latest.values()];
  const serviceRows = matching.filter(stage => stage.serviceKey);
  const values = serviceRows.length ? serviceRows : matching;
  if (!values.length) return { status: 'pending', label: '等待', description: '' };
  const aggregate = latest.get('');
  const aggregateTerminal = aggregate && ['succeeded', 'skipped', 'failed', 'cancelled'].includes(aggregate.status);
  const statuses = values.map(value => aggregateTerminal && ['pending', 'running'].includes(value.status) ? aggregate.status : value.status);
  if (serviceRows.length && aggregate && ['failed', 'cancelled'].includes(aggregate.status)) statuses.push(aggregate.status);
  const status = ['failed', 'running', 'cancelled', 'pending'].find(value => statuses.includes(value as Stage['status'])) || (statuses.every(value => value === 'skipped') ? 'skipped' : 'succeeded');
  const label = status === 'succeeded' && statuses.includes('skipped') ? '完成 · 部分跳过' : undefined;
  return { status, label, description: values.map(value => value.serviceKey).filter(Boolean).join('、') };
}
export function cancellationBlocked(task?: Task): boolean {
  return !!task && (task.phase.includes('commit') || ['rejected', 'not-cancellable', 'non-cancellable', 'noncancellable', 'too-late'].includes(task.cancelState));
}
export function taskSummary(task: Task): { title: string; description: string; variant: string } {
  const recoveryFailed = task.recoveryState === 'failed' || task.recoveryState === 'recovery-failed';
  const cleanupFailed = ['failed', 'release-failed', 'pending', 'unknown'].includes(task.cleanupState);
  if (recoveryFailed) return { title: '恢复失败，需要检查运行端', description: '任务未能确认恢复旧版本。请查看部署与健康检查日志，并根据运行端实际状态继续处理。', variant: 'error' };
  if (task.status === 'succeeded' && cleanupFailed) return { title: '应用执行完成，构建机待释放', description: '应用结果与资源清理分别记录。重试释放成功后再开始新一轮。', variant: 'warning' };
  if (task.status === 'succeeded') return { title: task.kind === 'rollback' ? '历史快照回滚已完成' : '发布已完成', description: '请核对探针、最终服务版本和构建资源状态。跳过检查与实际检查通过分别显示。', variant: 'success' };
  if (task.status === 'cancelled') return { title: '任务已取消', description: '远端已确认取消。恢复与资源清理的实际结果分别显示在下方。', variant: 'warning' };
  if (task.status === 'interrupted') return { title: '任务已中断', description: '后台已记录中断结果。请核对远端任务、服务版本和清理状态后生成新计划。', variant: 'warning' };
  return { title: '任务执行失败', description: task.error || '查看对应阶段日志及恢复结果，确认当前服务状态。', variant: 'error' };
}
