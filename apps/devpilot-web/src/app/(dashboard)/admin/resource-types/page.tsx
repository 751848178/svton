'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ResourceType {
  id: string;
  key: string;
  name: string;
  description?: string;
  category?: string;
  enabled: boolean;
  approvalMode: string;
  provisioningMode: string;
  requestSchema?: Record<string, unknown>;
  createdAt: string;
}

export default function ResourceTypesPage() {
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    try {
      const data = await api.get<ResourceType[]>('/resource-types?includeDisabled=true');
      setResourceTypes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const disableType = async (id: string) => {
    if (!confirm('确定要停用这个资源类型吗？')) return;
    await api.delete(`/resource-types/${id}`);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">资源类型</h1>
          <p className="text-muted-foreground mt-1">定义可申请资源的表单、审批和交付方式</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          新增类型
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : resourceTypes.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <h3 className="text-lg font-medium">还没有资源类型</h3>
          <p className="text-muted-foreground mt-2">添加 MySQL、Redis、端口号或自定义账号资源</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium">分类</th>
                <th className="px-4 py-3 text-left text-sm font-medium">审批/交付</th>
                <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
                <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {resourceTypes.map((type) => (
                <tr key={type.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{type.name}</div>
                    <code className="text-xs text-muted-foreground">{type.key}</code>
                    {type.description && (
                      <div className="text-xs text-muted-foreground mt-1">{type.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{type.category || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <div>{type.approvalMode}</div>
                    <div className="text-xs text-muted-foreground">{type.provisioningMode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      type.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {type.enabled ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {type.enabled && (
                      <button
                        onClick={() => disableType(type.id)}
                        className="px-2 py-1 text-xs rounded text-destructive hover:bg-destructive/10"
                      >
                        停用
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CreateResourceTypeModal
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

function CreateResourceTypeModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    category: 'infrastructure',
    description: '',
    approvalMode: 'manual',
    provisioningMode: 'manual',
    requestSchema: '{\n  "fields": []\n}',
    deliverySchema: '{\n  "fields": []\n}',
    envTemplate: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      await api.post('/resource-types', {
        key: formData.key,
        name: formData.name,
        category: formData.category || undefined,
        description: formData.description || undefined,
        approvalMode: formData.approvalMode,
        provisioningMode: formData.provisioningMode,
        requestSchema: JSON.parse(formData.requestSchema || '{}'),
        deliverySchema: JSON.parse(formData.deliverySchema || '{}'),
        envTemplate: formData.envTemplate || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建资源类型失败，请检查 JSON 格式');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">新增资源类型</h2>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Key</label>
              <input
                value={formData.key}
                onChange={(event) => setFormData({ ...formData, key: event.target.value })}
                required
                className="w-full px-3 py-2 border rounded-md"
                placeholder="mysql"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">名称</label>
              <input
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                required
                className="w-full px-3 py-2 border rounded-md"
                placeholder="MySQL 数据库"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">分类</label>
              <input
                value={formData.category}
                onChange={(event) => setFormData({ ...formData, category: event.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">审批方式</label>
              <select
                value={formData.approvalMode}
                onChange={(event) => setFormData({ ...formData, approvalMode: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="manual">manual</option>
                <option value="auto">auto</option>
                <option value="none">none</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">交付方式</label>
              <select
                value={formData.provisioningMode}
                onChange={(event) => setFormData({ ...formData, provisioningMode: event.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="manual">manual</option>
                <option value="pool">pool</option>
                <option value="webhook">webhook</option>
                <option value="api">api</option>
                <option value="script">script</option>
                <option value="credential_only">credential_only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-md resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">申请表单 Schema</label>
              <textarea
                value={formData.requestSchema}
                onChange={(event) => setFormData({ ...formData, requestSchema: event.target.value })}
                rows={7}
                className="w-full px-3 py-2 border rounded-md font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">交付 Schema</label>
              <textarea
                value={formData.deliverySchema}
                onChange={(event) => setFormData({ ...formData, deliverySchema: event.target.value })}
                rows={7}
                className="w-full px-3 py-2 border rounded-md font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">环境变量模板</label>
            <textarea
              value={formData.envTemplate}
              onChange={(event) => setFormData({ ...formData, envTemplate: event.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
              placeholder="DATABASE_URL=mysql://${username}:${password}@${host}:${port}/${database}"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
