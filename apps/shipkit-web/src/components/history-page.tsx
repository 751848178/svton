'use client';
import { useState } from 'react';
import { History, Play } from 'lucide-react';
import type { HistoryItem, Project, Task } from '@/lib/contracts';
import { useApi } from '@/hooks/use-api';
import { isBusy, time } from '@/lib/presentation';
import { EmptyPanel, ErrorMessage, LoadingPanel, PageHead, Status } from './primitives';
import { RollbackModal } from './rollback-modal';
import { ProjectBreadcrumbs } from './project-breadcrumbs';
import { RuntimeHistory } from './runtime-history';

export function HistoryPage({ project, onBack, onNew, onTask }: { project: Project; onBack: () => void; onNew: () => void; onTask: (task: Task) => void }) {
  const tasks = useApi('GET:/projects/:id/tasks', { id: project.id }, current => current?.items.some(isBusy) ? 2000 : 0);
  const history = useApi('GET:/projects/:id/history', { id: project.id });
  const [rollback, setRollback] = useState<HistoryItem | null>(null);
  return <>
    <ProjectBreadcrumbs project={project} current="发布记录" />
    <PageHead title="发布记录" description="平台发起的完整任务，包含成功、失败、取消和回滚。版本号按项目递增；失败任务也保留自己的版本号。" onBack={onBack} backLabel="返回项目详情"><button className="button primary" onClick={onNew}><Play size={16} aria-hidden="true" />开始新发布</button></PageHead>
    <ErrorMessage error={tasks.error} />
    {tasks.isLoading ? <LoadingPanel text="正在读取整轮发布记录…" /> : !tasks.data?.items.length ? <EmptyPanel text="本平台尚无发布任务。失败、取消和清理失败也会保留记录。" /> :
      <section className="panel"><div className="panel-head"><h2>平台发布任务</h2><span className="subtle">{tasks.data.items.length} 条任务</span></div><div className="table-wrap"><table className="service-table history-table"><thead><tr><th>发布版本</th><th>范围</th><th>时间</th><th>结果</th><th>操作</th></tr></thead><tbody>{tasks.data.items.map(task => {
        const snapshot = history.data?.items.find(item => item.releaseId === task.remoteReleaseId);
        return <tr key={task.id}><td><button className="task-link" title={`任务 ID：${task.id}`} onClick={() => onTask(task)}>{task.version}</button><p className="subtle">{task.kind === 'rollback' ? '按服务回滚' : task.kind === 'config-only' ? '仅更新运行配置' : '应用发布'}{!task.remoteReleaseId && ' · 未提交运行端变更'}</p></td><td data-label="范围">{task.selection?.length ? task.selection.map(service => <span className="service-pill" key={service}>{service}</span>) : <span className="subtle">在任务详情中查看</span>}</td><td data-label="时间">{time(task.createdAt)}</td><td data-label="结果"><Status value={task.status} />{['failed', 'release-failed'].includes(task.cleanupState) && <p className="subtle">构建机待释放</p>}</td><td><button className="button ghost small" onClick={() => onTask(task)}>查看详情与日志</button><button className="button secondary small" onClick={() => snapshot && setRollback(snapshot)} disabled={!snapshot?.rollbackAvailable} title={snapshot?.reason || (!snapshot ? '没有可用的历史快照' : undefined)}><History size={14} aria-hidden="true" />回滚</button></td></tr>;
      })}</tbody></table></div></section>}
    <div className="recent-panel"><ErrorMessage error={history.error} />{history.isLoading ? <LoadingPanel text="正在读取运行端历史快照…" /> : history.data && <RuntimeHistory history={history.data} tasks={tasks.data?.items || []} onRollback={setRollback} onTask={onTask} />}</div>
    {history.data && <RollbackModal item={rollback} history={history.data} project={project} onClose={() => setRollback(null)} onTask={onTask} />}
  </>;
}
