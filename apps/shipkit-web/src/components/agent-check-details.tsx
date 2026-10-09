import type { AgentResource, AgentResourceChecks } from '@/lib/agent-contracts';
import { time } from '@/lib/presentation';
import { Status } from './primitives';

function role(value?: string): string { return value === 'both' ? '运行与构建' : value === 'runtime' ? '运行' : value === 'builder' ? '构建' : '未确认'; }

export function AgentCheckDetails({ resource, result }: { resource: AgentResource; result?: AgentResourceChecks }) {
  if (!result) return <span className="subtle">尚未检查 · 版本、角色及 Docker 未确认</span>;
  const passed = result.checks.filter(check => check.ok).length;
  return <><Status value={result.status === 'partial' ? 'unknown' : result.status} label={result.status === 'succeeded' ? `${passed}/${result.checks.length} 关联可用` : result.status === 'partial' ? `${passed}/${result.checks.length} 可用 · 部分失败` : '检查失败'} />
    <p className="subtle agent-check-time">上次检查 {time(result.checkedAt)}</p>
    <details className="agent-check-details"><summary>查看角色与连接详情</summary>{result.checks.map(check => {
      const binding = resource.bindings.find(item => item.id === check.bindingId);
      return <div className="agent-check-row" key={check.bindingId}><strong>{binding?.projectName} · {binding?.targetKey || '现有构建机'}</strong><Status value={check.ok ? 'succeeded' : 'failed'} label={check.ok ? '可用' : '未通过'} />
        <p>实际机器角色：{role(check.machineRole)} · 凭据权限：{role(check.accessRole)}</p><p>Agent {check.version || '版本未确认'} · Docker {check.docker === true ? '可用' : check.docker === false ? '不可用' : '未确认'}</p>{check.error && <p className="form-error">{check.error}</p>}
      </div>;
    })}</details>
  </>;
}
