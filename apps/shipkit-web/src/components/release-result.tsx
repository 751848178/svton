'use client';
import { Check, TriangleAlert } from 'lucide-react';
import type { LiveProject, Project, TaskDetail } from '@/lib/contracts';
import { object, requiresCleanup, serverLabel, time } from '@/lib/presentation';
import { taskSummary } from '@/lib/task-state';
import { Status } from './primitives';
import { BuilderStatePanel } from './builder-state-panel';
import { ServiceTable } from './service-table';
import { ImageReference } from './image-reference';
import { ReleaseInputEvidence } from './release-input-evidence';

export function ReleaseResult({ project, live, detail, onHistory, onNew, onCleanup, busy }: { project: Project; live: LiveProject; detail: TaskDetail; onHistory: () => void; onNew: () => void; onCleanup: () => void; busy: boolean }) {
  const task = detail.task;
  const summary = taskSummary(task);
  const blocked = requiresCleanup(task);
  const output = object(task.output);
  const deployment = object(output.deploy || output);
  const changedRefs = Object.entries(object(deployment.changedRefs)).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  const Icon = summary.variant === 'success' ? Check : TriangleAlert;
  return <><section className={`result-banner ${summary.variant}`} role="status"><span className="result-symbol"><Icon size={27} aria-hidden="true" /></span><div><h2 className="result-title">{summary.title}</h2><p>{summary.description}</p><p className="subtle">版本 {task.version} · {time(task.finishedAt)}</p><div className="result-actions"><button className="button secondary" onClick={onHistory}>查看发布记录</button><button className="button primary" onClick={onNew} disabled={blocked}>开始新发布</button></div></div></section>
    <ReleaseInputEvidence plan={detail.plan} />
    {changedRefs.length > 0 && <section className="panel archived-images"><div className="panel-head"><h2>本次任务保存的服务镜像</h2><Status value={typeof deployment.verification === 'string' ? deployment.verification : null} label={deployment.verification === 'skipped' ? '健康检查已跳过' : undefined} /></div><div className="change-list">{changedRefs.map(([service, image]) => <div className="change-row" key={service}><strong>{service}</strong><ImageReference value={image} /><span className="tag neutral">任务归档</span></div>)}</div></section>}
    <div className="detail-grid"><section className="panel"><div className="panel-head"><h2>当前服务镜像</h2><span className="subtle">{serverLabel(project, live)}</span></div><ServiceTable project={project} live={live} /><div className="panel-body"><dl className="context-grid"><dt>任务结果</dt><dd><Status value={task.status} /></dd><dt>发布版本</dt><dd>{task.version}</dd><dt>取消状态</dt><dd><Status value={task.cancelState} /></dd><dt>恢复结果</dt><dd><Status value={task.recoveryState} /></dd><dt>构建资源</dt><dd><Status value={task.cleanupState} /></dd></dl>
      <dl className="context-grid health-checks">{detail.stages.filter(stage => stage.stageKey === 'verify').map((stage, index) => <div className="context-row" key={stage.id || index}><dt>健康检查 · {stage.serviceKey || '整体结果'}</dt><dd><Status value={stage.status} /></dd></div>)}</dl>
      <details className="technical-identifiers"><summary>任务技术标识</summary><dl className="context-grid"><dt>平台任务 ID</dt><dd className="mono">{task.id}</dd><dt>运行端发布 ID</dt><dd className="mono">{task.remoteReleaseId || '未产生变更'}</dd></dl></details>
      {task.error && <p className="form-error">{task.error}</p>}
    </div></section><BuilderStatePanel task={task} live={live} busy={busy} onCleanup={onCleanup} /></div>
  </>;
}
