'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface CDNConfig {
  id: string;
  name: string;
  domain: string;
  origin: string;
  provider: 'qiniu' | 'aliyun' | 'cloudflare';
  cacheRules: Array<{ path: string; ttl: number }>;
  project?: { id: string; name: string };
  createdAt: string;
}

interface TeamCredential {
  id: string;
  type: string;
  name: string;
  createdAt: string;
}

const providers = [
  { value: 'qiniu', label: '七牛云', icon: '🌐' },
  { value: 'aliyun', label: '阿里云', icon: '☁️' },
  { value: 'cloudflare', label: 'Cloudflare', icon: '🛡️' },
];

export default function CDNConfigsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<CDNConfig[]>([]);
  const [credentials, setCredentials] = useState<TeamCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'configs' | 'credentials'>('configs');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [configsData, credentialsData] = await Promise.all([
        api.get<CDNConfig[]>('/cdn-configs'),
        api.get<TeamCredential[]>('/team-credentials'),
      ]);
      setConfigs(configsData);
      setCredentials(credentialsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async (id: string) => {
    setPurgingId(id);
    try {
      await api.post(`/cdn-configs/${id}/purge`, {});
      alert('缓存清除请求已发送');
    } catch (error) {
      console.error('Purge failed:', error);
      alert('缓存清除失败');
    } finally {
      setPurgingId(null);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('确定要删除这个 CDN 配置吗？')) return;
    try {
      await api.delete(`/cdn-configs/${id}`);
      setConfigs(configs.filter(c => c.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleDeleteCredential = async (id: string) => {
    if (!confirm('确定要删除这个凭证吗？关联的 CDN 配置可能会受影响。')) return;
    try {
      await api.delete(`/team-credentials/${id}`);
      setCredentials(credentials.filter(c => c.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const getProviderLabel = (provider: string) => {
    return providers.find(p => p.value === provider)?.label || provider;
  };

  const getProviderIcon = (provider: string) => {
    return providers.find(p => p.value === provider)?.icon || '🌐';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CDN 配置管理</h1>
          <p className="text-muted-foreground mt-1">管理 CDN 加速配置和凭证</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCredentialModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
          >
            添加凭证
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加配置
          </button>
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('configs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'configs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          CDN 配置 ({configs.length})
        </button>
        <button
          onClick={() => setActiveTab('credentials')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'credentials' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          凭证管理 ({credentials.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : activeTab === 'configs' ? (
        configs.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <svg className="w-12 h-12 mx-auto text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium">还没有 CDN 配置</h3>
            <p className="mt-2 text-muted-foreground">添加 CDN 配置来加速您的网站</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {configs.map((config) => (
              <div key={config.id} className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getProviderIcon(config.provider)}</span>
                      <h3 className="font-medium">{config.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{getProviderLabel(config.provider)}</span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="font-mono">{config.domain}</span>
                      <span className="mx-2">→</span>
                      <span className="font-mono">{config.origin}</span>
                    </div>
                    {config.project && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        关联项目: {config.project.name}
                      </div>
                    )}
                    {config.cacheRules && config.cacheRules.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {config.cacheRules.slice(0, 3).map((rule, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-muted">
                            {rule.path}
                          </span>
                        ))}
                        {config.cacheRules.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{config.cacheRules.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePurge(config.id)}
                      disabled={purgingId === config.id}
                      className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent disabled:opacity-50"
                    >
                      {purgingId === config.id ? '清除中...' : '清除缓存'}
                    </button>
                    <button
                      onClick={() => router.push(`/cdn-configs/${config.id}`)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
                    >
                      详情
                    </button>
                    <button
                      onClick={() => handleDeleteConfig(config.id)}
                      className="px-3 py-1.5 text-sm font-medium rounded-md text-destructive hover:bg-destructive/10"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        credentials.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <svg className="w-12 h-12 mx-auto text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium">还没有凭证</h3>
            <p className="mt-2 text-muted-foreground">添加 CDN 提供商凭证以创建配置</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {credentials.map((cred) => (
                  <tr key={cred.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{cred.name}</td>
                    <td className="px-4 py-3 text-sm">{cred.type.replace('cdn_', '').toUpperCase()}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(cred.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteCredential(cred.id)}
                        className="px-2 py-1 text-xs font-medium rounded text-destructive hover:bg-destructive/10"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {showConfigModal && (
        <AddCDNConfigModal
          credentials={credentials}
          onClose={() => setShowConfigModal(false)}
          onSuccess={() => {
            setShowConfigModal(false);
            loadData();
          }}
        />
      )}

      {showCredentialModal && (
        <AddCredentialModal
          onClose={() => setShowCredentialModal(false)}
          onSuccess={() => {
            setShowCredentialModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}


function AddCDNConfigModal({
  credentials,
  onClose,
  onSuccess,
}: {
  credentials: TeamCredential[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    origin: '',
    provider: 'qiniu' as 'qiniu' | 'aliyun' | 'cloudflare',
    credentialId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filteredCredentials = credentials.filter(c => c.type === `cdn_${formData.provider}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/cdn-configs', formData);
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
        <h2 className="text-lg font-semibold mb-4">添加 CDN 配置</h2>

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
              placeholder="我的 CDN"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">CDN 提供商</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value as any, credentialId: '' })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="qiniu">七牛云</option>
              <option value="aliyun">阿里云</option>
              <option value="cloudflare">Cloudflare</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">凭证</label>
            <select
              value={formData.credentialId}
              onChange={(e) => setFormData({ ...formData, credentialId: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">选择凭证</option>
              {filteredCredentials.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {filteredCredentials.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">没有可用的凭证，请先添加凭证</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">CDN 域名</label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="cdn.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">源站地址</label>
            <input
              type="text"
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="origin.example.com"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent">
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !formData.credentialId}
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

function AddCredentialModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'cdn_qiniu',
    accessKey: '',
    secretKey: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/team-credentials', {
        name: formData.name,
        type: formData.type,
        config: {
          accessKey: formData.accessKey,
          secretKey: formData.secretKey,
        },
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
        <h2 className="text-lg font-semibold mb-4">添加凭证</h2>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">凭证名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md"
              placeholder="我的七牛云凭证"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">提供商</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="cdn_qiniu">七牛云</option>
              <option value="cdn_aliyun">阿里云</option>
              <option value="cdn_cloudflare">Cloudflare</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Access Key</label>
            <input
              type="text"
              value={formData.accessKey}
              onChange={(e) => setFormData({ ...formData, accessKey: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Secret Key</label>
            <input
              type="password"
              value={formData.secretKey}
              onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
            />
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
