/**
 * 资源池卡片
 *
 * 单一职责：渲染单个资源池 + 容量进度 + 编辑/删除操作。
 */

'use client';

import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { ProgressState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { ResourcePool } from '../types';
import { getPoolTypeInfo, resolvePoolTypeLabel } from '../constants';
import { PoolTypeIcon } from './pool-type-icons';

interface PoolCardProps {
  pool: ResourcePool;
  onEdit: (pool: ResourcePool) => void;
  onDelete: (id: string) => void;
}

export function PoolCard({ pool, onEdit, onDelete }: PoolCardProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const handleEdit = usePersistFn(() => onEdit(pool));
  const handleDelete = usePersistFn(() => onDelete(pool.id));
  const percent = pool.capacity > 0 ? (pool.allocated / pool.capacity) * 100 : 0;
  const typeInfo = getPoolTypeInfo(pool.type);

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PoolTypeIcon
              name={typeInfo.icon}
              className="h-6 w-6"
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold">{pool.name}</h3>
            <p
              className="truncate text-sm text-muted-foreground"
              title={pool.endpoint}
            >
              {pool.endpoint}
            </p>
          </div>
        </div>
        <StatusTag status={pool.status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{tc('type')}</p>
          <p className="font-medium">{resolvePoolTypeLabel(pool.type, t)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('capacity')}</p>
          <p className="font-medium">
            {pool.allocated} / {pool.capacity}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('available')}</p>
          <p className="font-medium">{pool.available}</p>
        </div>
      </div>

      <ProgressState
        percent={percent}
        text={t('allocated')}
      />

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleEdit}
          className="rounded px-3 py-1 text-sm text-primary hover:bg-primary/10"
        >
          {tc('edit')}
        </button>
        <button
          onClick={handleDelete}
          className="rounded px-3 py-1 text-sm text-destructive hover:bg-destructive/10"
        >
          {tc('delete')}
        </button>
      </div>
    </div>
  );
}
