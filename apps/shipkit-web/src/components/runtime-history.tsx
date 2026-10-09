import type { HistoryItem, HistoryView, Task } from '@/lib/contracts';
import { time } from '@/lib/presentation';
import { ChevronRight } from 'lucide-react';
import { HistoryInputs } from './history-inputs';

export function RuntimeHistory({ history, tasks, onRollback, onTask }: {
  history: HistoryView; tasks: Task[]; onRollback: (item: HistoryItem) => void; onTask: (task: Task) => void;
}) {
  const find = (id?: string | null) => id ? tasks.find(task => task.remoteReleaseId === id) : undefined;
  const current = find(history.current);
  return <details className="panel runtime-history">
    <summary className="panel-head"><ChevronRight size={18} aria-hidden="true" /><div><h2>运行端变更与回滚快照</h2><p className="subtle">补充记录 · {history.items.length} 条变更 · 当前 {current ? `版本 ${current.version}` : history.current ? '未关联变更' : '尚未部署'}</p></div></summary>
    <p className="panel-body subtle">由运行 Agent 记录实际服务变更，包含通过 CLI 发起的发布与回滚。可关联的版本对应上方平台任务；未关联变更没有匹配到已载入的平台任务。失败且未提交的任务不会出现在这里。</p>
    {!history.items.length ? <p className="state-message">运行端暂无历史变更。</p> : <div className="table-wrap"><table className="service-table history-table"><thead><tr><th>对应版本／变更</th><th>服务范围</th><th>提交时间</th><th>可恢复的旧快照</th><th>操作</th></tr></thead><tbody>{history.items.map(item => {
      const task = find(item.releaseId);
      const previous = item.targetSnapshotId || item.parentReleaseId;
      const target = find(previous);
      return <tr key={item.releaseId}>
        <td>{task ? <button className="task-link" onClick={() => onTask(task)}>{task.version}</button> : <strong>未关联任务</strong>}<p className="subtle mono" title={item.releaseId}>{item.releaseId}</p><HistoryInputs item={item} /></td>
        <td data-label="服务范围">{item.changedServices.map(service => <span className="service-pill" key={service}>{service}</span>)}</td>
        <td data-label="提交时间">{time(item.createdAt)}</td>
        <td data-label="可恢复的旧快照">{target ? `版本 ${target.version}` : previous ? <span className="mono">{previous}</span> : '无旧快照'}{!item.rollbackAvailable && <p className="subtle">{item.reason || '不可回滚'}</p>}</td>
        <td><button className="button secondary small" onClick={() => onRollback(item)} disabled={!item.rollbackAvailable}>选择服务回滚</button></td>
      </tr>;
    })}</tbody></table></div>}
  </details>;
}
