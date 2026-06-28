'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

interface Resource {
  id: string;
  type: string;
  name: string;
  createdAt: string;
}

interface ResourceField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  default?: string | number;
}

interface ResourceType {
  id: string;
  name: string;
  description?: string;
  fields: ResourceField[];
}

export default function ResourcesPage() {
  const { isAuthenticated } = useAuthStore();
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const resourceTypeMap = useMemo(() => {
    return Object.fromEntries(resourceTypes.map((type) => [type.id, type]));
  }, [resourceTypes]);

  useEffect(() => {
    if (isAuthenticated) {
      loadResources();
    }
  }, [isAuthenticated]);

  const loadResources = async () => {
    try {
      const [resourceData, typeData] = await Promise.all([
        api.get<Resource[]>('/resources'),
        api.get<ResourceType[]>('/registry/resource-types'),
      ]);
      setResources(resourceData);
      setResourceTypes(typeData);
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
      setResources(resources.filter((resource) => resource.id !== id));
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
                  {resourceTypeMap[resource.type]?.name || resource.type}
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
          resourceTypes={resourceTypes}
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
  resourceTypes,
  onClose,
  onSuccess,
}: {
  resourceTypes: ResourceType[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState(resourceTypes[0]?.id || '');
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedResourceType = useMemo(() => {
    return resourceTypes.find((resourceType) => resourceType.id === type);
  }, [resourceTypes, type]);

  useEffect(() => {
    if (!type && resourceTypes[0]) {
      setType(resourceTypes[0].id);
    }
  }, [resourceTypes, type]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      <div className="bg-background rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">添加资源</h2>

        {resourceTypes.length === 0 ? (
          <div className="text-sm text-muted-foreground">暂无可用资源类型</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">资源类型</label>
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setConfig({});
                }}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                {resourceTypes.map((resourceType) => (
                  <option key={resourceType.id} value={resourceType.id}>
                    {resourceType.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">资源名称</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md bg-background"
                placeholder="如：生产环境数据库"
              />
            </div>

            {selectedResourceType?.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-1">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </label>
                <input
                  type={field.type}
                  value={config[field.key] || ''}
                  onChange={(event) =>
                    setConfig({ ...config, [field.key]: event.target.value })
                  }
                  required={field.required}
                  placeholder={field.default?.toString()}
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
                disabled={isSubmitting || !type}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '添加中...' : '添加'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
