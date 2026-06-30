'use client';

import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader } from '@/components/ui';
import { useResourcePools } from '../hooks/use-resource-pools';
import { PoolCard } from './pool-card';
import { PoolFormModal } from './pool-form-modal';
import type { ResourcePool } from '../types';

/**
 * 资源池管理客户端视图。
 *
 * 接收首屏 server 数据 initialPools（SWR fallback），交互（新增/编辑/删除）在此完成。
 */
export function ResourcePoolsContent({ initialPools }: { initialPools?: ResourcePool[] }) {
  const {
    pools,
    loading,
    modalOpen,
    editingPool,
    form,
    setForm,
    openCreate,
    openEdit,
    closeModal,
    submit,
    remove,
  } = useResourcePools(initialPools);

  if (loading) {
    return <LoadingState text="" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="资源池管理"
        description="管理 MySQL、Redis 等资源池"
        actions={
          <button
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            添加资源池
          </button>
        }
      />

      {pools.length === 0 ? (
        <EmptyState text="暂无资源池" />
      ) : (
        <div className="grid gap-4">
          {pools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              onEdit={openEdit}
              onDelete={remove}
            />
          ))}
        </div>
      )}

      <PoolFormModal
        open={modalOpen}
        editingPool={editingPool}
        form={form}
        onChange={setForm}
        onClose={closeModal}
        onSubmit={submit}
      />
    </div>
  );
}
