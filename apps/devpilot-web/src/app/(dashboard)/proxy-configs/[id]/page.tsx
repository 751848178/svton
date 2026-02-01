'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface ProxyConfig {
  id: string;
  name: string;
  domain: string;
  upstreams: Array<{ host: string; port?: number; weight?: number }>;
  ssl: { enabled: boolean; type?: string; certPath?: string; keyPath?: string };
  websocket: boolean;
  status: 'pending' | 'active' | 'error';
  generatedConfig?: string;
  server?: { id: string; name: string; host: string; status: string };
  project?: { id: string; name: string };
  createdBy?: { id: string; name: string | null; email: string };
  createdAt: string;
  updatedAt: string;
}

export default function ProxyConfigDetailPage() {
  const params = useParams();
  const router = useRouter();
  const configId = params.id as string;

  const [config, setConfig] = useState<ProxyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewConfig, setPreviewConfig] = useState('');

  useEffect(() => {
    loadConfig();
  }, [configId]);

  const loadConfig = async () => {
    try {
      const data = await api.get<ProxyConfig>(`/proxy-configs/${configId}`);
      setConfig(data);
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post(`/proxy-configs/${configId}/sync`);
      loadConfig();
      alert('同步成功');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handlePreview = async () => {
    try {
      const result = await api.get<{ config: string }>(`/proxy-configs/${configId}/preview`);
      setPreviewConfig(result.config);
      setShowPreview(true);
    } catch (error) {
      console.error('Preview failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个代理配置吗？')) return;
    try {
      await api.delete(`/proxy-configs/${configId}`);
      router.push('/proxy-configs');
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

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  if (!config) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">配置不存在</p>
        <button onClick={() => router.push('/proxy-configs')} className="mt-4 text-primary hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push('/proxy-configs')} className="text-muted-foreground hover:text-foreground">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">{config.name}</h1>
        {getStatusBadge(config.status)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 基本信息 */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">基本信息</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">域名</dt>
                <dd className="font-mono">{config.domain}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">SSL</dt>
                <dd>{config.ssl.enabled ? `已启用 (${config.ssl.type})` : '未启用'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">WebSocket</dt>
                <dd>{config.websocket ? '已启用' : '未启用'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">关联服务器</dt>
                <dd>{config.server ? config.server.name : '未关联'}</dd>
              </div>
              {config.project && (
                <div>
                  <dt className="text-muted-foreground">关联项目</dt>
                  <dd>{config.project.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">创建时间</dt>
                <dd>{new Date(config.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* 上游配置 */}
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">上游服务器</h2>
            <div className="space-y-2">
              {config.upstreams.map((upstream, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                  <span className="font-mono text-sm">{upstream.host}:{upstream.port || 80}</span>
                  {upstream.weight && (
                    <span className="text-xs text-muted-foreground">权重: {upstream.weight}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 生成的配置 */}
          {config.generatedConfig && (
            <div className="border rounded-lg p-6">
              <h2 className="font-semibold mb-4">Nginx 配置</h2>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {config.generatedConfig}
              </pre>
            </div>
          )}
        </div>

        {/* 操作面板 */}
        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">操作</h2>
            <div className="space-y-2">
              <button
                onClick={handleSync}
                disabled={syncing || !config.server}
                className="w-full px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {syncing ? '同步中...' : '同步到服务器'}
              </button>
              <button
                onClick={handlePreview}
                className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
              >
                预览 Nginx 配置
              </button>
              {config.server && (
                <button
                  onClick={() => router.push(`/servers/${config.server!.id}`)}
                  className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
                >
                  查看服务器
                </button>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-6 border-destructive/50">
            <h2 className="font-semibold text-destructive mb-4">危险操作</h2>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除配置
            </button>
          </div>
        </div>
      </div>

      {/* 预览弹窗 */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Nginx 配置预览</h2>
              <button onClick={() => setShowPreview(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              {previewConfig}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
