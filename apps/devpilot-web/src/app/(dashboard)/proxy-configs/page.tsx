'use client';

import { createElement, Suspense as ReactSuspense, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function SuspenseBoundary({ children, fallback }: { children: ReactNode; fallback: ReactNode }): any {
  return createElement(ReactSuspense as any, { fallback }, children);
}

interface ProxyConfig {
  id: string;
  name: string;
  domain: string;
  upstreams: Array<{ host: string; port?: number }>;
  ssl: { enabled: boolean; type?: string };
  websocket: boolean;
  status: 'pending' | 'active' | 'error';
  server?: { id: string; name: string; host: string; status: string };
  project?: { id: string; name: string };
  createdAt: string;
}

interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

function ProxyConfigsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [configs, setConfigs] = useState<ProxyConfig[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    if (searchParams.get('new') === 'true') {
      setShowModal(true);
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      const [configsData, serversData] = await Promise.all([
        api.get<ProxyConfig[]>('/proxy-configs'),
        api.get<Server[]>('/servers'),
      ]);
      setConfigs(configsData);
      setServers(serversData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await api.post(`/proxy-configs/${id}/sync`);
      loadData();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个代理配置吗？')) return;
    try {
      await api.delete(`/proxy-configs/${id}`);
      setConfigs(configs.filter(c => c.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">已生效</span>;
      case 'error':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">错误</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">待同步</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">代理配置</h1>
          <p className="text-muted-foreground mt-1">管理 Nginx 反向代理配置</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加配置
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : configs.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <svg className="w-12 h-12 mx-auto text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <h3 className="mt-4 text-lg font-medium">还没有代理配置</h3>
          <p className="mt-2 text-muted-foreground">添加代理配置来管理域名转发</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium">域名</th>
                <th className="px-4 py-3 text-left text-sm font-medium">上游</th>
                <th className="px-4 py-3 text-left text-sm font-medium">服务器</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {configs.map((config) => (
                <tr key={config.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{config.name}</div>
                    <div className="text-xs text-muted-foreground flex gap-2">
                      {config.ssl.enabled && <span>🔒 SSL</span>}
                      {config.websocket && <span>🔌 WS</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{config.domain}</td>
                  <td className="px-4 py-3 text-sm">
                    {config.upstreams.map((u, i) => (
                      <div key={i} className="font-mono text-xs">{u.host}:{u.port || 80}</div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {config.server ? (
                      <span className="text-muted-foreground">{config.server.name}</span>
                    ) : (
                      <span className="text-muted-foreground/50">未关联</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(config.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleSync(config.id)}
                        disabled={syncingId === config.id || !config.server}
                        className="px-2 py-1 text-xs font-medium rounded border hover:bg-accent disabled:opacity-50"
                      >
                        {syncingId === config.id ? '同步中...' : '同步'}
                      </button>
                      <button
                        onClick={() => router.push(`/proxy-configs/${config.id}`)}
                        className="px-2 py-1 text-xs font-medium rounded border hover:bg-accent"
                      >
                        详情
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="px-2 py-1 text-xs font-medium rounded text-destructive hover:bg-destructive/10"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AddProxyConfigModal
          servers={servers}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

export default function ProxyConfigsPage() {
  return (
    <SuspenseBoundary fallback={<div className="text-center py-12 text-muted-foreground">加载中...</div>}>
      <ProxyConfigsContent />
    </SuspenseBoundary>
  );
}

function AddProxyConfigModal({
  servers,
  onClose,
  onSuccess,
}: {
  servers: Server[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    upstreamHost: '',
    upstreamPort: 80,
    sslEnabled: false,
    sslType: 'letsencrypt' as 'letsencrypt' | 'custom' | 'none',
    websocket: false,
    serverId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/proxy-configs', {
        name: formData.name,
        domain: formData.domain,
        upstreams: [{ host: formData.upstreamHost, port: formData.upstreamPort }],
        ssl: {
          enabled: formData.sslEnabled,
          type: formData.sslEnabled ? formData.sslType : 'none',
        },
        websocket: formData.websocket,
        serverId: formData.serverId || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">添加代理配置</h2>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">配置名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="我的网站"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">域名</label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="example.com"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">上游地址</label>
              <input
                type="text"
                value={formData.upstreamHost}
                onChange={(e) => setFormData({ ...formData, upstreamHost: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-md"
                placeholder="127.0.0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">端口</label>
              <input
                type="number"
                value={formData.upstreamPort}
                onChange={(e) => setFormData({ ...formData, upstreamPort: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">目标服务器</label>
            <select
              value={formData.serverId}
              onChange={(e) => setFormData({ ...formData, serverId: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">不关联服务器</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.sslEnabled}
                onChange={(e) => setFormData({ ...formData, sslEnabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">启用 SSL</span>
            </label>

            {formData.sslEnabled && (
              <select
                value={formData.sslType}
                onChange={(e) => setFormData({ ...formData, sslType: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="letsencrypt">Let&apos;s Encrypt（自动）</option>
                <option value="custom">自定义证书</option>
              </select>
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.websocket}
                onChange={(e) => setFormData({ ...formData, websocket: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">启用 WebSocket</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
