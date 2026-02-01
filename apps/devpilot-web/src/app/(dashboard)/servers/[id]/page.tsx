'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  updatedAt: string;
  createdBy?: { id: string; name: string | null; email: string };
  proxyConfigs?: Array<{ id: string; name: string; domain: string; status: string }>;
}

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;

  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', tags: '' });

  useEffect(() => {
    loadServer();
  }, [serverId]);

  const loadServer = async () => {
    try {
      const data = await api.get<Server>(`/servers/${serverId}`);
      setServer(data);
      setEditForm({
        name: data.name,
        tags: data.tags?.join(', ') || '',
      });
    } catch (error) {
      console.error('Failed to load server:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await api.post<{ success: boolean; status: string; latency: number; message: string }>(
        `/servers/${serverId}/test`
      );
      setServer(prev => prev ? { ...prev, status: result.status as Server['status'] } : null);
      alert(result.message + (result.success ? ` (${result.latency}ms)` : ''));
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTesting(false);
    }
  };

  const handleDetectServices = async () => {
    setDetecting(true);
    try {
      const result = await api.post<{ services: Record<string, boolean>; message: string }>(
        `/servers/${serverId}/detect`
      );
      setServer(prev => prev ? { ...prev, services: result.services } : null);
      alert(result.message);
    } catch (error) {
      console.error('Detection failed:', error);
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/servers/${serverId}`, {
        name: editForm.name,
        tags: editForm.tags ? editForm.tags.split(',').map(t => t.trim()) : [],
      });
      setEditing(false);
      loadServer();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个服务器吗？关联的代理配置也会被删除。')) return;
    try {
      await api.delete(`/servers/${serverId}`);
      router.push('/servers');
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

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  if (!server) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">服务器不存在</p>
        <button onClick={() => router.push('/servers')} className="mt-4 text-primary hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push('/servers')} className="text-muted-foreground hover:text-foreground">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">{server.name}</h1>
        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(server.status)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 基本信息 */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">基本信息</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="text-sm text-primary hover:underline">
                  编辑
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:underline">
                    取消
                  </button>
                  <button onClick={handleSave} className="text-sm text-primary hover:underline">
                    保存
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">名称</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">标签（逗号分隔）</label>
                  <input
                    type="text"
                    value={editForm.tags}
                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">主机</dt>
                  <dd className="font-mono">{server.host}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">端口</dt>
                  <dd>{server.port}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">用户名</dt>
                  <dd>{server.username}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">认证方式</dt>
                  <dd>{server.authType === 'password' ? '密码' : 'SSH 密钥'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">标签</dt>
                  <dd className="flex gap-1 mt-1">
                    {server.tags && server.tags.length > 0 ? (
                      server.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-muted">{tag}</span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">无</span>
                    )}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* 检测到的服务 */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">已安装服务</h2>
              <button
                onClick={handleDetectServices}
                disabled={detecting}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                {detecting ? '检测中...' : '重新检测'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(server.services || {}).map(([name, installed]) => (
                <div
                  key={name}
                  className={`px-3 py-2 rounded-md text-sm ${
                    installed ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {name}
                  {installed && <span className="ml-1">✓</span>}
                </div>
              ))}
              {Object.keys(server.services || {}).length === 0 && (
                <p className="col-span-3 text-muted-foreground text-sm">点击"重新检测"来检测服务器上安装的服务</p>
              )}
            </div>
          </div>

          {/* 关联的代理配置 */}
          {server.proxyConfigs && server.proxyConfigs.length > 0 && (
            <div className="border rounded-lg p-6">
              <h2 className="font-semibold mb-4">关联的代理配置</h2>
              <div className="space-y-2">
                {server.proxyConfigs.map((config) => (
                  <div key={config.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div>
                      <div className="font-medium">{config.name}</div>
                      <div className="text-sm text-muted-foreground">{config.domain}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      config.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {config.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 操作面板 */}
        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">操作</h2>
            <div className="space-y-2">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              <button
                onClick={() => router.push(`/proxy-configs/new?serverId=${server.id}`)}
                className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
              >
                添加代理配置
              </button>
            </div>
          </div>

          <div className="border rounded-lg p-6 border-destructive/50">
            <h2 className="font-semibold text-destructive mb-4">危险操作</h2>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除服务器
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
