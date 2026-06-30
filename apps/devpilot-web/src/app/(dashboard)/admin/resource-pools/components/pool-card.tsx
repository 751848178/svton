/**
 * 资源池卡片
 *
 * 单一职责：渲染单个资源池 + 容量进度 + 编辑/删除操作。
 */

import { usePersistFn } from '@svton/hooks';
import { ProgressState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { ResourcePool } from '../types';

interface PoolCardProps {
  pool: ResourcePool;
  onEdit: (pool: ResourcePool) => void;
  onDelete: (id: string) => void;
}

export function PoolCard({ pool, onEdit, onDelete }: PoolCardProps) {
  const handleEdit = usePersistFn(() => onEdit(pool));
  const handleDelete = usePersistFn(() => onDelete(pool.id));
  const percent = pool.capacity > 0 ? (pool.allocated / pool.capacity) * 100 : 0;

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
            <span className="font-bold text-blue-600">{pool.type.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{pool.name}</h3>
            <p className="text-sm text-gray-500">{pool.endpoint}</p>
          </div>
        </div>
        <StatusTag status={pool.status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-500">类型</p>
          <p className="font-medium">{pool.type.toUpperCase()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">容量</p>
          <p className="font-medium">
            {pool.allocated} / {pool.capacity}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">可用</p>
          <p className="font-medium">{pool.available}</p>
        </div>
      </div>

      <ProgressState
        percent={percent}
        text="已分配"
      />

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleEdit}
          className="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
        >
          编辑
        </button>
        <button
          onClick={handleDelete}
          className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50"
        >
          删除
        </button>
      </div>
    </div>
  );
}
