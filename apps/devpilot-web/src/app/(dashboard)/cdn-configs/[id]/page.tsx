'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface CDNConfig {
  id: string;
  name: string;
  domain: string;
  origin: string;
  provider: 'qiniu' | 'aliyun' | 'cloudflare';
  cacheRules: Array<{ path: string; ttl: number }>;
  project?: { id: string; name: string };
  credential?: { id: string; name: string };
  createdBy?: { id: string; name: string | null; email: string };
  createdAt: string;
  updatedAt: string;
}

const providers: Record<string, { label: string; icon: string }> = {
  qiniu: { label: '七牛云', icon: '🌐' },
  aliyun: { label: '阿里云', icon: '☁️' },
  cloudflare: { label: 'Cloudflare', icon: '🛡️' },
};

export default function CDNConfigDetailPage() {
  const params = useParams();
  const router = useRouter();
  const configId = params.id as string;

  const [config, setConfig] = useState<CDNConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', origin: '' });
  const [purgePaths, setPurgePaths] = useState('');
  const [showPurgeModal, setShowPurgeModal] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [configId]);

  const loadConfig = async () => {
    try {
      const data = await api.get<CDNConfig>(`/cdn-configs/${configId}`);
      setConfig(data);
      setEditForm({ name: data.name, origin: data.origin });
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async (paths?: string[]) => {
    setPurging(true);
    try {
      await api.post(`/cdn-configs/${configId}/purge`, { paths });
      alert('缓存清除请求已发送');
      setShowPurgeModal(false);
      setPurgePaths('');
    } catch (error) {
      console.error('Purge failed:', error);
      alert('缓存清除失败');
    } finally {
      setPurging(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/cdn-configs/${configId}`, editForm);
      setEditing(false);
      loadConfig();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个 CDN 配置吗？')) return;
    try {
      await api.delete(`/cdn-configs/${configId}`);
      router.push('/cdn-configs');
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  if (!config) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">配置不存在</p>
        <button onClick={() => router.push('/cdn-configs')} className="mt-4 text-primary hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  const provider = providers[config.provider] || { label: config.provider, icon: '🌐' };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push('/cdn-configs')} className="text-muted-foreground hover:text-foreground">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xl">{provider.icon}</span>
        <h1 className="text-2xl font-bold">{config.name}</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{provider.label}</span>
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
                  <label className="block text-sm font-medium mb-1">源站地址</label>
                  <input
                    type="text"
                    value={editForm.origin}
                    onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">CDN 域名</dt>
                  <dd className="font-mono">{config.domain}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">源站地址</dt>
                  <dd className="font-mono">{config.origin}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">提供商</dt>
                  <dd>{provider.label}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">凭证</dt>
                  <dd>{config.credential?.name || '未知'}</dd>
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
            )}
          </div>

          {/* 缓存规则 */}
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">缓存规则</h2>
            {config.cacheRules && config.cacheRules.length > 0 ? (
              <div className="space-y-2">
                {config.cacheRules.map((rule, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <span className="font-mono text-sm">{rule.path}</span>
                    <span className="text-xs text-muted-foreground">TTL: {rule.ttl}s</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">使用默认缓存规则</p>
            )}
          </div>
        </div>

        {/* 操作面板 */}
        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">操作</h2>
            <div className="space-y-2">
              <button
                onClick={() => handlePurge()}
                disabled={purging}
                className="w-full px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {purging ? '清除中...' : '清除全部缓存'}
              </button>
              <button
                onClick={() => setShowPurgeModal(true)}
                className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
              >
                清除指定路径
              </button>
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

      {/* 清除指定路径弹窗 */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPurgeModal(false)} />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">清除指定路径缓存</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">路径（每行一个）</label>
                <textarea
                  value={purgePaths}
                  onChange={(e) => setPurgePaths(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                  placeholder="/images/*&#10;/css/*&#10;/js/*"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowPurgeModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
                >
                  取消
                </button>
                <button
                  onClick={() => handlePurge(purgePaths.split('\n').filter(p => p.trim()))}
                  disabled={purging || !purgePaths.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {purging ? '清除中...' : '清除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
