import type { ConfigDifference as Difference } from '@/lib/config-contracts';

export function ConfigDifference({ value, unavailable }: { value?: Difference; unavailable?: string }) {
  if (!value || value.status === 'not-comparable') return <p className="subtle">{unavailable || '当前历史配置无法逐键比较。'}</p>;
  const unchanged = !value.added.length && !value.removed.length && !value.changed.length && !value.noEnvChanged;
  return <div className="config-difference">{unchanged ? <span className="subtle">变量无变化</span> : <>{value.added.length > 0 && <span>新增：{value.added.join('、')}</span>}{value.changed.length > 0 && <span>修改：{value.changed.join('、')}</span>}{value.removed.length > 0 && <span>删除：{value.removed.join('、')}</span>}{value.noEnvChanged && <span>环境变量启用状态改变</span>}</>}</div>;
}
