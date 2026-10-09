'use client';
import type { RepositoryInput } from '@/lib/source-contracts';
import { SourceRefFields } from './source-ref-fields';

export function RepositoryFields({ value, onChange, token, onToken, username, onUsername, disabled, hasCredential, hasUsername, clearUsername, onClearUsername, clearCredential, onClearCredential, prefix = 'repository' }: {
  value: RepositoryInput; onChange: (value: RepositoryInput) => void; token: string; onToken: (token: string) => void; disabled?: boolean;
  username: string; onUsername: (username: string) => void; hasUsername?: boolean; clearUsername?: boolean; onClearUsername?: (clear: boolean) => void;
  hasCredential?: boolean; clearCredential?: boolean; onClearCredential?: (clear: boolean) => void; prefix?: string;
}) {
  return <>
    <label htmlFor={`${prefix}-url`}>HTTPS 仓库地址<input id={`${prefix}-url`} type="url" value={value.url} onChange={event => onChange({ ...value, url: event.target.value })} disabled={disabled} placeholder="https://git.example.com/team/project.git" autoComplete="off" required /><span className="form-help">公开仓库无需凭据。仅允许管理员已开放的 Git 主机。</span></label>
    <SourceRefFields value={value.ref} onChange={ref => onChange({ ...value, ref })} disabled={disabled} prefix={prefix} />
    <label htmlFor={`${prefix}-spec`}>发布定义路径<input id={`${prefix}-spec`} value={value.specPath || ''} onChange={event => onChange({ ...value, specPath: event.target.value })} disabled={disabled} placeholder="ship.yaml" /><span className="form-help">相对仓库根目录；构建上下文也以仓库根目录解析。</span></label>
    <label htmlFor={`${prefix}-token`}>{hasCredential ? '替换仓库读取凭据' : '仓库读取 Token（私有仓库）'}<input id={`${prefix}-token`} type="password" autoComplete="new-password" value={token} onChange={event => onToken(event.target.value)} disabled={disabled || clearCredential} placeholder={hasCredential ? '已配置；留空保留现有凭据' : '只读 Token，不写入仓库地址'} /><span className="form-help">保存后不回填秘密。凭据不进入源码、计划或日志。</span></label>
    <label htmlFor={`${prefix}-username`}>Git 访问用户名（可选）<input id={`${prefix}-username`} value={username} onChange={event => onUsername(event.target.value)} disabled={disabled || clearCredential || clearUsername} autoComplete="off" placeholder={hasUsername ? '已配置；留空保留现有用户名' : '留空使用默认 Token 用户名'} /><span className="form-help">部署令牌可能需要专用用户名；单独提交，不写入仓库地址。</span></label>
    {hasUsername && onClearUsername && <label className="inline-checkbox"><input type="checkbox" checked={clearUsername || false} onChange={event => onClearUsername(event.target.checked)} disabled={disabled || clearCredential} />清除访问用户名，恢复默认 Token 用户名</label>}
    {hasCredential && onClearCredential && <label className="inline-checkbox"><input type="checkbox" checked={clearCredential || false} onChange={event => onClearCredential(event.target.checked)} disabled={disabled} />清除读取凭据，仅用于公开仓库</label>}
  </>;
}
