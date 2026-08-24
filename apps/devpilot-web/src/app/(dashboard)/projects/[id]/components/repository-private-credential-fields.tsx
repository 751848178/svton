import { Field, Input, Select } from '@/components/ui';
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
      <Field label="只读凭据">
        <Select
          className="bg-background"
          value={props.mode}
          onChange={(event) => props.setMode(event.target.value)}
        >
          <option value="existing">选择已有凭据</option>
          <option value="inline-token">新增 HTTPS Token</option>
          <option value="inline-ssh">新增 SSH 私钥</option>
        </Select>
      </Field>
      {props.mode === 'existing' ? (
        <Select
          className="bg-background"
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
        </Select>
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
