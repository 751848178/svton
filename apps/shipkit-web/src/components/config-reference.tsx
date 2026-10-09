import type { ConfigBinding } from '@/lib/config-contracts';

export function configReference(binding?: ConfigBinding): string {
  if (!binding) return '历史文件配置（未记录版本关联）';
  if (binding.version) return `${binding.mode === 'inherit' ? '继承 ' : ''}${binding.name || '配置'} · ${binding.version}`;
  return binding.mode === 'files' ? '历史文件配置' : binding.mode === 'inherit' ? '继承服务当前配置' : '冻结配置版本（原记录未保存名称）';
}
export function ConfigReference({ value }: { value?: ConfigBinding }) { return <span className="config-reference">{configReference(value)}</span>; }
