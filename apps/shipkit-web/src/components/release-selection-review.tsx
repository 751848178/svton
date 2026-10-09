import type { Plan } from '@/lib/contracts';
import { releaseReviewServices, releaseReviewSource } from '@/lib/release-review';
import { ImageReference } from './image-reference';
import { ReleaseInputEvidence } from './release-input-evidence';

export function ReleaseSelectionReview({ plan }: { plan: Plan }) {
  const rows = releaseReviewServices(plan);
  return <><section className="panel"><div className="panel-head"><div><h2>本次任务的服务范围</h2><p className="subtle">从已保存的计划恢复；本页只读。</p></div><span className="tag neutral">版本 {plan.version}</span></div>
    <div className="table-wrap"><table className="service-table"><thead><tr><th>服务</th><th>本次范围</th><th>计划中的配置 / 镜像</th></tr></thead><tbody>{rows.map(row => <tr key={row.serviceKey}><td><strong>{row.serviceKey}</strong></td><td>{row.action}</td><td>{row.imageRef ? <ImageReference value={row.imageRef} /> : <span className="version" title={row.detail}>{row.detail}</span>}</td></tr>)}</tbody></table></div>
    <dl className="context-list"><dt>运行目标</dt><dd>{plan.detail.targetKey || '原计划未记录'}</dd><dt>源码来源</dt><dd>{releaseReviewSource(plan)}</dd><dt>源码提交</dt><dd className="mono">{plan.detail.sourceSnapshot?.commit || plan.detail.gitRef || '原计划未记录提交'}</dd><dt>环境配置</dt><dd>{plan.detail.configBindings ? '逐服务配置见下方归档输入' : plan.keepEnv ? '保留运行端已提交配置' : '使用计划中的服务环境配置'}</dd><dt>构建机</dt><dd>{plan.kind === 'config-only' ? '仅更新配置，不创建构建机' : plan.kind === 'rollback' ? '回滚不创建构建机' : plan.keepBuilder ? '按配置窗口保留' : '完成构建后释放'}</dd></dl>
  </section><ReleaseInputEvidence plan={plan} /></>;
}
