import type { Plan } from '@/lib/contracts';
import { ConfigReference } from './config-reference';
import { SourceReference } from './source-reference';
import { planServiceConfig, planServiceSource } from '@/lib/release-inputs';

export function ReleaseInputEvidence({ plan }: { plan?: Plan }) {
  if (!plan) return null;
  const source = plan.detail.sourceSnapshot;
  const bindings = plan.detail.configBindings;
  const sources = plan.detail.currentSources;
  const restored = plan.kind === 'rollback' ? plan.detail.history?.restoreServices : undefined;
  if (!source && !bindings && !sources && !restored) return null;
  const keys = [...new Set([...Object.keys(bindings || {}), ...Object.keys(sources || {}), ...Object.keys(restored || {}), ...plan.selection])];
  return <section className="panel release-input-evidence"><div className="panel-head"><h2>本次发布保存的源码与配置</h2><span className="subtle">归档输入，不读取最新版本</span></div>
    {source && <dl className="context-list"><dt>仓库</dt><dd className="source-url">{source.repoUrl}</dd><dt>请求引用</dt><dd>{source.requestedRef.kind} · {source.requestedRef.value}</dd><dt>固定提交</dt><dd className="mono source-commit">{source.commit}</dd><dt>发布定义</dt><dd>{source.specPath}</dd></dl>}
    {plan.kind === 'config-only' && <p className="panel-body subtle">仅更新运行配置；各服务沿用当前镜像与原始源码，不读取新的 Git 提交。</p>}
    <div className="table-wrap"><table className="config-binding-table"><thead><tr><th>服务</th><th>配置来源</th><th>固定源码</th><th>本轮范围</th></tr></thead><tbody>{keys.map(key => <tr key={key}><td data-label="服务">{key}</td><td data-label="配置来源"><ConfigReference value={planServiceConfig(plan, key)} /></td><td data-label="固定源码"><SourceReference value={planServiceSource(plan, key)} /></td><td data-label="本轮范围">{plan.selection.includes(key) ? plan.kind === 'rollback' ? '恢复快照' : '本轮更新' : '完整继承'}</td></tr>)}</tbody></table></div>
  </section>;
}
