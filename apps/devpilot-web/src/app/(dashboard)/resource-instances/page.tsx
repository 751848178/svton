'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ResourceInstance {
  id: string;
  name: string;
  status: 'active' | 'released' | 'expired' | 'revoked';
  delivery?: Record<string, unknown>;
  hasCredentials: boolean;
  expiresAt?: string;
  releasedAt?: string;
  createdAt: string;
  resourceType?: { id: string; key: string; name: string };
  project?: { id: string; name: string };
  request?: { id: string; title: string };
}

const statusLabels: Record<ResourceInstance['status'], string> = {
  active: '使用中',
  released: '已释放',
  expired: '已过期',
  revoked: '已回收',
};

export default function ResourceInstancesPage() {
  const [instances, setInstances] = useState<ResourceInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await api.get<ResourceInstance[]>('/resource-instances');
      setInstances(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const releaseInstance = async (id: string) => {
    if (!confirm('确定要释放这个资源实例吗？')) return;
    await api.post(`/resource-instances/${id}/release`);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">资源实例</h1>
        <p className="text-muted-foreground mt-1">查看资源申请交付后的实际资源占用</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : instances.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <h3 className="text-lg font-medium">还没有资源实例</h3>
          <p className="text-muted-foreground mt-2">完成资源申请交付后会在这里出现</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {instances.map((instance) => (
            <div key={instance.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{instance.name}</h3>
                    {getStatusBadge(instance.status)}
                    {instance.hasCredentials && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-muted">含凭证</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {instance.resourceType?.name || '-'} · {instance.project?.name || '未关联项目'}
                  </div>
                  {instance.request && (
                    <div className="text-xs text-muted-foreground mt-1">
                      来源申请：{instance.request.title}
                    </div>
                  )}
                </div>
                {instance.status === 'active' && (
                  <button
                    onClick={() => releaseInstance(instance.id)}
                    className="px-3 py-1.5 text-sm rounded-md border hover:bg-accent"
                  >
                    释放
                  </button>
                )}
              </div>

              {instance.delivery && Object.keys(instance.delivery).length > 0 && (
                <pre className="mt-3 bg-muted p-3 rounded-md text-xs overflow-x-auto">
                  {JSON.stringify(instance.delivery, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getStatusBadge(status: ResourceInstance['status']) {
  const classes: Record<ResourceInstance['status'], string> = {
    active: 'bg-green-100 text-green-700',
    released: 'bg-gray-100 text-gray-700',
    expired: 'bg-yellow-100 text-yellow-700',
    revoked: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${classes[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
