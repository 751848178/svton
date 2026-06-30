/**
 * 添加服务器弹窗
 *
 * 单一职责：收集服务器字段（含密码/密钥切换）并提交。
 */

import { useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { Modal, ErrorBanner } from '@/components/ui';
import type { ServerInput } from '../types';

interface AddServerModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: ServerInput) => Promise<void>;
}

interface ServerForm {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  credentials: string;
  tags: string;
}

export function AddServerModal({ open, onClose, onCreate }: AddServerModalProps) {
  const [form, setForm] = useSetState<ServerForm>({
    name: '',
    host: '',
    port: 22,
    username: 'root',
    authType: 'password',
    credentials: '',
    tags: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onCreate({
        name: form.name,
        host: form.host,
        port: Number(form.port),
        username: form.username,
        authType: form.authType,
        credentials: form.credentials,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
      });
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
      title="添加服务器"
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
          <span className="mb-1 block font-medium">服务器名称</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="生产服务器"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block text-sm">
            <span className="mb-1 block font-medium">主机地址</span>
            <input
              value={form.host}
              onChange={(e) => setForm({ host: e.target.value })}
              required
              className="w-full rounded-md border px-3 py-2"
              placeholder="192.168.1.1"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">端口</span>
            <input
              type="number"
              value={form.port}
              onChange={(e) => setForm({ port: Number(e.target.value) })}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">用户名</span>
          <input
            value={form.username}
            onChange={(e) => setForm({ username: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">认证方式</span>
          <select
            value={form.authType}
            onChange={(e) => setForm({ authType: e.target.value as 'password' | 'key' })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="password">密码</option>
            <option value="key">SSH 私钥</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            {form.authType === 'password' ? '密码' : 'SSH 私钥'}
          </span>
          {form.authType === 'password' ? (
            <input
              type="password"
              value={form.credentials}
              onChange={(e) => setForm({ credentials: e.target.value })}
              required
              className="w-full rounded-md border px-3 py-2"
            />
          ) : (
            <textarea
              value={form.credentials}
              onChange={(e) => setForm({ credentials: e.target.value })}
              required
              rows={4}
              className="w-full rounded-md border px-3 py-2 font-mono text-xs"
              placeholder="-----BEGIN RSA PRIVATE KEY-----"
            />
          )}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">标签（逗号分隔）</span>
          <input
            value={form.tags}
            onChange={(e) => setForm({ tags: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
            placeholder="production, web"
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
