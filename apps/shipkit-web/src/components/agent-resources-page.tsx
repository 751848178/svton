'use client';
import { ChevronRight, RefreshCw, Server } from 'lucide-react';
import { useAgentResources } from '@/hooks/use-agent-resources';
import { EmptyPanel, ErrorMessage, LoadingPanel, PageHead } from './primitives';
import { AgentCheckDetails } from './agent-check-details';

export function AgentResourcesPage({ onProject, onProjects }: { onProject: (projectId: string) => void; onProjects: () => void }) {
  const control = useAgentResources();
  const { data, error, isLoading, isValidating, mutate } = control.inventory;
  return <>
    <PageHead title="Agent 资源" description="集中查看已有配置中的运行时机器和构建机器。同一 Agent 访问地址合并展示，实际服务器名称见关联项目与目标。">
      <button className="button secondary" onClick={() => void mutate()} disabled={isValidating}><RefreshCw size={16} aria-hidden="true" />{isValidating ? '正在读取…' : '刷新资源'}</button>
    </PageHead><ErrorMessage error={error} />
    {isLoading ? <LoadingPanel text="正在读取已注册项目的 Agent 连接配置…" /> : data && <>
      {data.issues.length > 0 && <section className="panel agent-config-issues"><div className="panel-head"><h2>部分项目配置无法读取</h2><span className="subtle">其他资源仍可查看和检查</span></div><div className="panel-body">{data.issues.map(issue => <div className="agent-config-issue" key={issue.projectId}><div><strong>{issue.projectName}</strong><p className="subtle">{issue.message}</p></div><button className="button secondary small" onClick={() => onProject(issue.projectId)}>项目连接与配置</button></div>)}</div></section>}
      {!data.items.length ? <EmptyPanel text="尚未读取到固定 Agent 连接。注册项目并引用已有配置后，连接会出现在这里。"><button className="button secondary" onClick={onProjects}>查看项目</button></EmptyPanel> : <section className="panel"><div className="panel-head"><h2>已有 Agent 连接</h2><span className="subtle">{data.items.length} 个访问地址 · 检查仅访问状态接口</span></div><div className="table-wrap"><table className="agent-resource-table"><thead><tr><th>Agent 访问地址</th><th>配置用途</th><th>关联项目与目标</th><th>连接检查</th><th>操作</th></tr></thead><tbody>{data.items.map(resource => <tr key={resource.id}>
        <td data-label="Agent 访问地址"><div className="agent-endpoint"><Server size={18} aria-hidden="true" /><code>{resource.endpoint}</code></div><p className="subtle">Shipkit 通过此地址访问 Agent；可能经端口转发，不等同于服务器 IP。</p></td>
        <td data-label="配置用途">{resource.usages.map(usage => <span className="service-pill" key={usage}>{usage === 'runtime' ? '运行时机器' : '构建机器'}</span>)}</td>
        <td data-label="关联项目与目标"><div className="agent-bindings">{resource.bindings.map(binding => <button className="inline-link" key={binding.id} onClick={() => onProject(binding.projectId)}>{binding.projectName} · {binding.targetKey || '现有构建机'}{binding.selected ? '（当前目标）' : ''}{binding.displayName && <span className="subtle">{binding.displayName}</span>}</button>)}</div></td>
        <td data-label="连接检查"><AgentCheckDetails resource={resource} result={control.resultFor(resource)} /><ErrorMessage error={control.errors[resource.id]} /></td>
        <td><button className="button secondary small" onClick={() => void control.check(resource.id)} disabled={control.pending[resource.id]}>{control.pending[resource.id] ? '正在检查…' : '检查连接'}</button></td>
      </tr>)}</tbody></table></div></section>}
      {data.dynamicBuilders.length > 0 && <details className="panel agent-dynamic-policies"><summary className="panel-head"><ChevronRight size={18} aria-hidden="true" /><h2>按需构建机配置</h2><span className="subtle">{data.dynamicBuilders.length} 个项目 · 无固定 Agent 端点</span></summary><div className="panel-body"><p className="subtle">这些是项目的按需创建策略，不表示已有机器。构建机创建、使用和释放结果记录在发布任务中。</p>{data.dynamicBuilders.map(policy => <div className="agent-policy-row" key={policy.projectId}><button className="inline-link" onClick={() => onProject(policy.projectId)}>{policy.projectName}</button><span>{[policy.provider, policy.region, policy.zone, policy.instanceType].filter(Boolean).join(' · ')}</span></div>)}</div></details>}
    </>}
  </>;
}
