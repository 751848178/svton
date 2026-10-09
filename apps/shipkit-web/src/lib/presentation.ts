import type { LiveProject, Project, StageKey, Task } from './contracts';

export const stageKeys: StageKey[] = ['provision', 'build', 'push', 'cleanup', 'deploy', 'verify'];
export const stageLabels: Record<StageKey, string> = {
  provision: '创建构建机', build: '构建镜像', push: '推送镜像', cleanup: '释放构建机', deploy: '部署服务', verify: '健康检查',
};
export const stageDescriptions: Record<StageKey, string> = {
  provision: '按构建方式准备执行环境', build: '仅构建本次选中的服务', push: '推送至已配置的镜像仓库',
  cleanup: '归档日志后释放临时构建资源', deploy: '运行端更新选中的服务', verify: '显示实际探针与恢复结果',
};
const statusLabels: Record<string, string> = {
  queued: '等待执行', pending: '等待', running: '进行中', 'cancel-requested': '取消请求中', succeeded: '完成',
  failed: '失败', cancelled: '已取消', interrupted: '已中断', skipped: '已跳过', requested: '请求中',
  none: '无需处理', released: '已释放', retained: '保留中', 'release-failed': '释放失败',
  'not-required': '无需处理', 'not-needed': '无需处理', recovered: '已恢复', 'recovery-failed': '恢复失败',
  'not-created': '未创建', active: '运行中', restored: '已恢复', unavailable: '不可用',
  static: '绑定机器，无需释放', kept: '保留复用', noncancellable: '提交阶段不可取消',
  'non-cancellable': '提交阶段不可取消', 'not-cancellable': '当前阶段不可取消', 'too-late': '已进入提交阶段',
  available: '当前可请求取消', acknowledged: '取消已确认', rejected: '取消未获确认',
  unknown: '结果尚未确认', releasing: '正在释放', passed: '检查通过',
};
export function statusLabel(status?: string | null): string { return status ? statusLabels[status] ?? status : '尚无结果'; }
export function isBusy(task?: Task | null): boolean { return !!task && (['queued', 'running', 'cancel-requested'].includes(task.status) || (task.status === 'interrupted' && task.finishedAt === null) || task.cleanupState === 'releasing'); }
export function requiresCleanup(task?: Task): boolean { return !!task && !isBusy(task) && ['failed', 'release-failed', 'unknown', 'pending'].includes(task.cleanupState); }
export function tone(status?: string | null): 'good' | 'warn' | 'error' | 'neutral' {
  if (status && ['succeeded', 'released', 'recovered', 'restored', 'ok'].includes(status)) return 'good';
  if (status && ['failed', 'recovery-failed', 'release-failed', 'interrupted'].includes(status)) return 'error';
  if (status && ['cancelled', 'cancel-requested', 'skipped', 'retained', 'requested'].includes(status)) return 'warn';
  return 'neutral';
}
export function time(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
}
export function shortId(value?: string | null): string { return value || '尚无版本'; }
export function serverLabel(project: Project, live?: LiveProject): string {
  return project.serverName || live?.targetKey || project.targetKey || '尚未选择部署目标';
}
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
export function portLabel(spec: unknown): string { return strings(object(spec).ports).join('、') || '未声明'; }
export function shellQuote(value: string): string { return `'${value.replaceAll("'", "'\\''")}'`; }
export function phaseLabel(value: string): string {
  return stageLabels[value as StageKey] || ({ preflight: '核对执行基线', commit: '提交版本', recovery: '恢复原版本', complete: '执行结束' } as Record<string, string>)[value] || value;
}
export function eventLabel(value: string): string {
  return ({ stage: '步骤状态', log: '日志', cleanup: '资源清理', recovery: '版本恢复', cancel: '取消响应', diagnostic: '诊断',
    'remote-job': '远端任务', 'remote-event': '远端事件', 'remote-intent': '请求远端执行' } as Record<string, string>)[value] || value;
}
export function diagnosticLabel(value: string): string {
  const labels: Record<string, string> = {
    node: '本机 Node.js', configuration: '项目配置', source: '源码', runtime: '运行端 Agent', registry: '镜像仓库', builder: '构建端 Agent',
    'jobs-cooperative-cancel-v1': '安全取消协议', 'jobs-events-v1': '任务事件协议', 'jobs-log-cursor-v1': '日志归档协议',
    'group-baseline-v1': '并发基线校验', 'group-target-rollback-v1': '指定历史快照回滚',
  };
  if (value.startsWith('env:')) return `${value.slice(4)} · 环境配置引用`;
  if (value.startsWith('resources:')) return `${value.slice(10)} · 外部资源声明`;
  return labels[value] || value;
}
export function verificationLevel(value: string): string {
  return ({ local: '本机环境', validated: '配置结构校验', 'local-git': '本机 Git', 'authenticated-agent': 'Agent 鉴权与连接',
    'configuration-only': '仅配置确认', 'not-provisioned': '尚未创建', 'authenticated-capability': 'Agent 能力检查',
    'reference-exists': '引用文件存在', 'declared-constraints': '声明约束；执行时检查可用性' } as Record<string, string>)[value] || value;
}
export function releaseCommand(project: Project, selected: string[], sourceMode = 'git', options: { keepEnv?: boolean; keepBuilder?: boolean } = {}): string {
  return `cd ${shellQuote(project.rootPath)} && ship release --config ${shellQuote(project.configPath)}${project.targetKey ? ` --to ${shellQuote(project.targetKey)}` : ''} --services ${shellQuote(selected.join(','))}${sourceMode === 'directory' ? ' --from-dir .' : ''}${options.keepEnv ? ' --keep-env' : ''}${options.keepBuilder ? ' --keep-builder' : ''} --json`;
}
