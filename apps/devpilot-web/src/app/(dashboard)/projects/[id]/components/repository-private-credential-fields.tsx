import { Input } from '@/components/ui';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';

type Props = {
  mode: string;
  setMode: (value: string) => void;
  options: RepositoryAnalysisHook['state']['credentialOptions'];
  credentialId: string;
  setCredentialId: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  username: string;
  setUsername: (value: string) => void;
  secret: string;
  setSecret: (value: string) => void;
};

export function PrivateCredentialFields(props: Props) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">只读凭据</span>
        <select
          className="h-10 w-full rounded-md border bg-background px-3"
          value={props.mode}
          onChange={(event) => props.setMode(event.target.value)}
        >
          <option value="existing">选择已有凭据</option>
          <option value="inline-token">新增 HTTPS Token</option>
          <option value="inline-ssh">新增 SSH 私钥</option>
        </select>
      </label>
      {props.mode === 'existing' ? (
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={props.credentialId}
          onChange={(event) => props.setCredentialId(event.target.value)}
        >
          <option value="">请选择</option>
          {props.options.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="凭据名称"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
          />
          <Input
            placeholder="用户名（可选）"
            value={props.username}
            onChange={(e) => props.setUsername(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Input
              type="password"
              placeholder={props.mode === 'inline-ssh' ? 'SSH 私钥' : '访问令牌'}
              value={props.secret}
              onChange={(e) => props.setSecret(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
