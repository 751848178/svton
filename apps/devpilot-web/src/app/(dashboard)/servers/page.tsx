'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  status: 'online' | 'offline' | 'unknown';
  tags: string[];
  services: Record<string, boolean>;
  createdAt: string;
  _count?: { proxyConfigs: number };
}

export default function ServersPage() {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const data = await api.get<Server[]>('/servers');
      setServers(data);
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const result = await api.post<{ success: boolean; status: string; latency: number; message: string }>(
        `/servers/${id}/test`
      );
      setServers(servers.map(s => s.id === id ? { ...s, status: result.status as Server['status'] } : s));
      alert(result.message + (result.success ? ` (${result.latency}ms)` : ''));
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个服务器吗？')) return;
    try {
      await api.delete(`/servers/${id}`);
      setServers(servers.filter(s => s.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return '在线';
      case 'offline': return '离线';
      default: return '未知';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">服务器管理</h1>
          <p className="text-muted-foreground mt-1">管理团队的服务器资源</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加服务器
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : servers.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <svg className="w-12 h-12 mx-auto text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <h3 className="mt-4 text-lg font-medium">还没有服务器</h3>
          <p className="mt-2 text-muted-foreground">添加服务器来管理代理配置</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {servers.map((server) => (
            <div key={server.id} className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(server.status)}`} />
                    <h3 className="font-medium">{server.name}</h3>
                    <span className="text-xs text-muted-foreground">{getStatusText(server.status)}</span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span>{server.username}@{server.host}:{server.port}</span>
                    <span className="mx-2">•</span>
                    <span>{server.authType === 'password' ? '密码认证' : '密钥认证'}</span>
                  </div>
                  {server.tags && server.tags.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {server.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {server._count && server._count.proxyConfigs > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {server._count.proxyConfigs} 个代理配置
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(server.id)}
                    disabled={testingId === server.id}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent disabled:opacity-50"
                  >
                    {testingId === server.id ? '测试中...' : '测试连接'}
                  </button>
                  <button
                    onClick={() => router.push(`/servers/${server.id}`)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
                  >
                    详情
                  </button>
                  <button
                    onClick={() => handleDelete(server.id)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md text-destructive hover:bg-destructive/10"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddServerModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadServers();
          }}
        />
      )}
    </div>
  );
}

function AddServerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    username: 'root',
    authType: 'password' as 'password' | 'key',
    credentials: '',
    tags: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/servers', {
        ...formData,
        port: Number(formData.port),
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
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
        <h2 className="text-lg font-semibold mb-4">添加服务器</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">服务器名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="生产服务器"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">主机地址</label>
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-md"
                placeholder="192.168.1.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">端口</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">用户名</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">认证方式</label>
            <select
              value={formData.authType}
              onChange={(e) => setFormData({ ...formData, authType: e.target.value as 'password' | 'key' })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="password">密码</option>
              <option value="key">SSH 私钥</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {formData.authType === 'password' ? '密码' : 'SSH 私钥'}
            </label>
            {formData.authType === 'password' ? (
              <input
                type="password"
                value={formData.credentials}
                onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            ) : (
              <textarea
                value={formData.credentials}
                onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                required
                rows={4}
                className="w-full px-3 py-2 border rounded-md font-mono text-xs"
                placeholder="-----BEGIN RSA PRIVATE KEY-----"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">标签（逗号分隔）</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="production, web"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
            >
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
