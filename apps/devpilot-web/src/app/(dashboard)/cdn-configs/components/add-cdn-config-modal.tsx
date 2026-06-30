/**
 * 添加 CDN 配置弹窗
 *
 * 单一职责：收集 CDN 配置字段并提交。
 */

import { useMemo, useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { Modal } from '@/components/ui';
import { ErrorBanner } from '@/components/ui';
import type { TeamCredential, CDNConfigInput } from '../types';

interface AddCDNConfigModalProps {
  open: boolean;
  credentials: TeamCredential[];
  onClose: () => void;
  onCreate: (input: CDNConfigInput) => Promise<void>;
}

export function AddCDNConfigModal({
  open,
  credentials,
  onClose,
  onCreate,
}: AddCDNConfigModalProps) {
  const [form, setForm] = useSetState<CDNConfigInput>({
    name: '',
    domain: '',
    origin: '',
    provider: 'qiniu',
    credentialId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filteredCredentials = useMemo(
    () => credentials.filter((c) => c.type === `cdn_${form.provider}`),
    [credentials, form.provider],
  );

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onCreate(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="添加 CDN 配置"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {error ? (
          <ErrorBanner
            message={error}
            variant="inline"
          />
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">配置名称</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="我的 CDN"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">CDN 提供商</span>
          <select
            value={form.provider}
            onChange={(e) => setForm({ provider: e.target.value, credentialId: '' })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="qiniu">七牛云</option>
            <option value="aliyun">阿里云</option>
            <option value="cloudflare">Cloudflare</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">凭证</span>
          <select
            value={form.credentialId}
            onChange={(e) => setForm({ credentialId: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">选择凭证</option>
            {filteredCredentials.map((c) => (
              <option
                key={c.id}
                value={c.id}
              >
                {c.name}
              </option>
            ))}
          </select>
          {filteredCredentials.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">没有可用的凭证，请先添加凭证</p>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">CDN 域名</span>
          <input
            value={form.domain}
            onChange={(e) => setForm({ domain: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="cdn.example.com"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">源站地址</span>
          <input
            value={form.origin}
            onChange={(e) => setForm({ origin: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="origin.example.com"
          />
        </label>
        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving || !form.credentialId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? '添加中...' : '添加'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
