'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

interface Resource {
  id: string;
  type: string;
  name: string;
  createdAt: string;
}

const resourceTypeNames: Record<string, string> = {
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  redis: 'Redis',
  'qiniu-kodo': '七牛云 Kodo',
  'sms-aliyun': '阿里云短信',
};

export default function ResourcesPage() {
  const { isAuthenticated } = useAuthStore();
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadResources();
    }
  }, [isAuthenticated]);

  const loadResources = async () => {
    try {
      const data = await api.get<Resource[]>('/resources');
      setResources(data);
    } catch (error) {
      console.error('Failed to load resources:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个资源吗？')) return;

    try {
      await api.delete(`/resources/${id}`);
      setResources(resources.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Failed to delete resource:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">资源管理</h1>
          <p className="text-muted-foreground">
            管理你的数据库、缓存、存储等资源凭证
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          添加资源
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">还没有添加任何资源</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-primary hover:underline"
          >
            添加第一个资源
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <h3 className="font-medium">{resource.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {resourceTypeNames[resource.type] || resource.type}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(resource.id)}
                  className="px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddResourceModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadResources();
          }}
        />
      )}
    </div>
  );
}

function AddResourceModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState('mysql');
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resourceFields: Record<string, { key: string; label: string; type: string }[]> = {
    mysql: [
      { key: 'host', label: '主机地址', type: 'text' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'username', label: '用户名', type: 'text' },
      { key: 'password', label: '密码', type: 'password' },
      { key: 'database', label: '数据库名', type: 'text' },
    ],
    redis: [
      { key: 'host', label: '主机地址', type: 'text' },
      { key: 'port', label: '端口', type: 'number' },
      { key: 'password', label: '密码', type: 'password' },
      { key: 'db', label: '数据库', type: 'number' },
    ],
    'qiniu-kodo': [
      { key: 'accessKey', label: 'Access Key', type: 'text' },
      { key: 'secretKey', label: 'Secret Key', type: 'password' },
      { key: 'bucket', label: 'Bucket', type: 'text' },
      { key: 'domain', label: 'CDN 域名', type: 'text' },
    ],
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await api.post('/resources', { type, name, config });
      onSuccess();
    } catch (error) {
      console.error('Failed to create resource:', error);
      alert('创建资源失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">添加资源</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">资源类型</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setConfig({});
              }}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="mysql">MySQL</option>
              <option value="redis">Redis</option>
              <option value="qiniu-kodo">七牛云 Kodo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">资源名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="如：生产环境数据库"
            />
          </div>

          {resourceFields[type]?.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium mb-1">{field.label}</label>
              <input
                type={field.type}
                value={config[field.key] || ''}
                onChange={(e) =>
                  setConfig({ ...config, [field.key]: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? '添加中...' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
