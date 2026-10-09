'use client';
import { History, Play, Settings } from 'lucide-react';
import type { LiveProject, Project, Task } from '@/lib/contracts';
import { useApi } from '@/hooks/use-api';
import { isBusy, serverLabel, time } from '@/lib/presentation';
import { ErrorMessage, PageHead, Status } from './primitives';
import { ProjectConfigPanel } from './project-config-panel';
import { ServiceTable } from './service-table';

export function ProjectOverview({ project, live, onBack, onRelease, onHistory, onSettings, onTask }: {
  project: Project; live: LiveProject; onBack: () => void; onRelease: () => void; onHistory: () => void;
  onSettings: () => void; onTask: (task: Task) => void;
}) {
  const tasks = useApi('GET:/projects/:id/tasks', { id: project.id }, current => current?.items.some(isBusy) ? 2000 : 0);
  const latest = tasks.data?.items[0];
  const active = tasks.data?.items.find(isBusy);
  return <>
    <div className="breadcrumbs"><button onClick={onBack}>项目</button><span>›</span><span>{project.name}</span></div>
    <PageHead title={project.name} description={`部署目标 ${serverLabel(project, live)} · ${live.targetKey}`} onBack={onBack}>
      <button className="button secondary" onClick={onSettings}><Settings size={16} aria-hidden="true" />连接与配置</button>
      <button className="button secondary" onClick={onHistory}><History size={16} aria-hidden="true" />发布记录</button>
      <button className="button primary" onClick={active ? () => onTask(active) : onRelease}><Play size={16} aria-hidden="true" />{active ? '继续查看发布' : '开始发布'}</button>
    </PageHead>
    <ErrorMessage error={tasks.error} />
    {active && <p className="notice-message" role="status">版本 {active.version} 正在执行。新的发布需等待该任务结束。</p>}
    {!live.runtime.check.ok && <p className="notice-message">运行 Agent 检查失败：{live.runtime.check.error || '连接不可用'}。当前服务状态尚未确认。</p>}
    <div className="detail-grid"><section className="panel"><div className="panel-head"><h2>当前应用服务</h2><span className="subtle">{live.services.length} 个服务</span></div><ServiceTable project={project} live={live} /><div className="panel-body subtle">点击服务名，在新标签页打开服务入口。未选择的服务沿用当前版本。</div></section><ProjectConfigPanel project={project} live={live} /></div>
    <section className="panel recent-panel"><div className="panel-head"><h2>最近发布</h2><button className="button ghost small" onClick={onHistory}>全部记录</button></div><div className="recent-release">
      {latest ? <><Status value={latest.status} /><div><button className="task-link task-id" onClick={() => onTask(latest)} title={`任务 ID：${latest.id}`}>{latest.version}</button><p className="subtle">{latest.kind === 'rollback' ? '历史快照回滚' : latest.kind === 'config-only' ? '运行配置发布' : '应用发布'} · {time(latest.createdAt)}</p></div></> : <p className="subtle">本平台尚无发布记录。</p>}
    </div></section>
  </>;
}
