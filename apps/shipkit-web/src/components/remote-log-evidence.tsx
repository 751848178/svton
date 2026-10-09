import type { RemoteJob, TaskEvent } from '@/lib/contracts';
import { eventCategories, remoteJobEvidence } from '@/lib/log-remote-evidence';
import { time } from '@/lib/presentation';
import { Status } from './primitives';

export function RemoteLogEvidence({ jobs, events }: { jobs: RemoteJob[]; events: TaskEvent[] }) {
  if (!jobs.length && !events.length) return null;
  return <section className="log-evidence-section" aria-label="远端任务与已载入事件">
    <header className="log-section-head"><h3>远端任务与已载入事件</h3><span className="tag">{jobs.length} 个任务 · {events.length} 条事件</span></header>
    <p className="log-section-description">远端任务按服务展示最终状态；归档和轮询事件是同步记录，不重复作为日志正文。</p>
    {jobs.length > 0 && <div className="log-remote-jobs"><h4>远端执行任务</h4>{jobs.map(job => {
      const record = remoteJobEvidence(job, events);
      return <article className="log-evidence-record" key={job.jobId}>
        <header><h4>{job.serviceKey || '整个发布范围'}</h4><span className="log-agent-role">{job.agentRole === 'builder' ? '构建端' : '运行端'}</span><Status value={job.status} /></header>
        <p className="log-record-time">状态更新 <time>{time(record.updatedAt)}</time></p>
        <dl className="log-result-fields"><div><dt>远端任务标识</dt><dd><code>{job.jobId}</code></dd></div>{record.logOffset != null && <div><dt>归档日志游标</dt><dd>{record.logOffset.toLocaleString('zh-CN')} 字节</dd></div>}{record.eventOffset != null && <div><dt>远端事件游标</dt><dd>序号 {record.eventOffset}</dd></div>}</dl>
      </article>;
    })}</div>}
    {events.length > 0 && <details className="log-event-breakdown"><summary><span>事件分类与排障数据</span><span className="log-event-count">已载入 {events.length} 条</span></summary>
      <p className="log-section-description">仅统计当前已载入事件；阶段状态以上方持久保存的结果为准。</p>
      <dl className="log-event-categories">{eventCategories(events).map(category => <div key={category.type}><dt>{category.label}<small>{category.description}</small></dt><dd>{category.count} 条</dd></div>)}</dl>
      <details className="log-raw-evidence"><summary>已载入原始事件数据（JSON）</summary><pre>{JSON.stringify(events, null, 2)}</pre></details>
    </details>}
  </section>;
}
