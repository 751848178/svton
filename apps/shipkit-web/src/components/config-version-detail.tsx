import { ChevronRight } from 'lucide-react';
import type { ConfigVersion } from '@/lib/config-contracts';
import { time } from '@/lib/presentation';

export function ConfigVersionDetail({ value, onClose }: { value: ConfigVersion; onClose: () => void }) {
  return <section className="panel config-version-detail"><div className="panel-head"><div><h2>{value.name} · {value.version}</h2><p className="subtle">环境 {value.targetKey} · 冻结于 {time(value.createdAt)}{value.archivedAt && ' · 已归档'}</p></div><button className="button ghost small" onClick={onClose}>收起详情</button></div>
    <div className="panel-body">{value.services.map((service, index) => <details className="config-service-editor" key={service.serviceKey} open={index === 0}><summary><ChevronRight size={16} aria-hidden="true" /><strong>{service.serviceKey}</strong><span className="subtle">{service.noEnv ? '无需环境变量' : `${service.variables.length} 个变量`}</span></summary>
      {!service.noEnv && <div className="table-wrap"><table className="config-readonly-table"><thead><tr><th>变量</th><th>值</th><th>类型</th></tr></thead><tbody>{service.variables.map(variable => <tr key={variable.key}><td data-label="变量">{variable.key}</td><td data-label="值">{variable.secret ? variable.hasValue ? '已设置（不展示秘密）' : '未设置' : variable.value === '' ? '空字符串' : variable.value ?? '未设置'}</td><td data-label="类型">{variable.secret ? '秘密' : '普通变量'}</td></tr>)}</tbody></table></div>}
    </details>)}</div>
  </section>;
}
