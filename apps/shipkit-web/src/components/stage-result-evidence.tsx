import type { Stage } from '@/lib/contracts';
import { evidenceFields } from '@/lib/log-evidence-fields';
import { time } from '@/lib/presentation';
import { LogEvidenceFields } from './log-evidence-fields';
import { Status } from './primitives';

export function StageResultEvidence({ results }: { results: Stage[] }) {
  if (!results.length) return null;
  return <section className="log-evidence-section" aria-label="阶段结果与检查证据">
    <header className="log-section-head"><h3>阶段结果与检查证据</h3><span className="tag">{results.length} 条结果</span></header>
    <p className="log-section-description">展示本阶段返回的构建、部署或检查结果；原始数据保留在每条结果下方。</p>
    <div className="log-evidence-records">{results.map((value, index) => <article className="log-evidence-record" key={`${value.serviceKey}:${value.attempt}:${index}`}>
      <header><h4>{value.serviceKey || '阶段整体结果'}</h4><span className="log-attempt">第 {value.attempt || 1} 次</span><Status value={value.status} /></header>
      <p className="log-record-time">记录更新 <time>{time(value.updatedAt || value.finishedAt || value.startedAt)}</time></p>
      <LogEvidenceFields fields={evidenceFields(value.detail)} />
      <details className="log-raw-evidence"><summary>原始结果数据（JSON）</summary><pre>{JSON.stringify(value.detail, null, 2)}</pre></details>
    </article>)}</div>
  </section>;
}
