/**
 * 添加代理配置弹窗
 *
 * 单一职责：收集代理配置字段并提交。
 */

import { useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { Modal, ErrorBanner } from '@/components/ui';
import type { Server, ProxyConfigInput } from '../types';

interface AddProxyConfigModalProps {
  open: boolean;
  servers: Server[];
  onClose: () => void;
  onCreate: (input: ProxyConfigInput) => Promise<void>;
}

export function AddProxyConfigModal({
  open,
  servers,
  onClose,
  onCreate,
}: AddProxyConfigModalProps) {
  const [form, setForm] = useSetState<ProxyConfigInput>({
    name: '',
    domain: '',
    upstreamHost: '',
    upstreamPort: 80,
    sslEnabled: false,
    sslType: 'letsencrypt',
    websocket: false,
    serverId: '',
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
      title="添加代理配置"
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
            placeholder="我的网站"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">域名</span>
          <input
            value={form.domain}
            onChange={(e) => setForm({ domain: e.target.value })}
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="example.com"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block text-sm">
            <span className="mb-1 block font-medium">上游地址</span>
            <input
              value={form.upstreamHost}
              onChange={(e) => setForm({ upstreamHost: e.target.value })}
              required
              className="w-full rounded-md border px-3 py-2"
              placeholder="127.0.0.1"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">端口</span>
            <input
              type="number"
              value={form.upstreamPort}
              onChange={(e) => setForm({ upstreamPort: Number(e.target.value) })}
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">目标服务器</span>
          <select
            value={form.serverId}
            onChange={(e) => setForm({ serverId: e.target.value })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">不关联服务器</option>
            {servers.map((s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {s.name} ({s.host})
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.sslEnabled}
              onChange={(e) => setForm({ sslEnabled: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">启用 SSL</span>
          </label>
          {form.sslEnabled ? (
            <select
              value={form.sslType}
              onChange={(e) => setForm({ sslType: e.target.value as ProxyConfigInput['sslType'] })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="letsencrypt">Let&apos;s Encrypt（自动）</option>
              <option value="custom">自定义证书</option>
            </select>
          ) : null}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.websocket}
              onChange={(e) => setForm({ websocket: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">启用 WebSocket</span>
          </label>
        </div>
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
