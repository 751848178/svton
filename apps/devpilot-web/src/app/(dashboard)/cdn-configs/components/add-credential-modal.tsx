/**
 * 添加凭证弹窗
 *
 * 单一职责：收集 CDN 凭证字段并提交。
 */

import { useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { Modal, ErrorBanner } from '@/components/ui';
import type { CredentialInput } from '../types';

interface AddCredentialModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CredentialInput) => Promise<void>;
}

export function AddCredentialModal({ open, onClose, onCreate }: AddCredentialModalProps) {
  const [form, setForm] = useSetState<CredentialInput>({
    name: '',
    type: 'cdn_qiniu',
    accessKey: '',
    secretKey: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      title="添加凭证"
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
          <span className="mb-1 block font-medium">凭证名称</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="我的七牛云凭证"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">提供商</span>
          <select
            value={form.type}
            onChange={(e) => setForm({ type: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="cdn_qiniu">七牛云</option>
            <option value="cdn_aliyun">阿里云</option>
            <option value="cdn_cloudflare">Cloudflare</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Access Key</span>
          <input
            value={form.accessKey}
            onChange={(e) => setForm({ accessKey: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Secret Key</span>
          <input
            type="password"
            value={form.secretKey}
            onChange={(e) => setForm({ secretKey: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2 font-mono text-sm"
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
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? '添加中...' : '添加'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
