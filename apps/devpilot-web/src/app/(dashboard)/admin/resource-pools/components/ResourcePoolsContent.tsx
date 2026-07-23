'use client';

import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner } from '@/components/ui';
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
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const {
    pools,
    loading,
    loadError,
    refresh,
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
    return <LoadingState text={tc('loading')} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('poolsPageTitle')}
        description={t('poolsPageDescription')}
        actions={
          <button
            onClick={openCreate}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            {t('addPool')}
          </button>
        }
      />

      {loadError ? (
        <ErrorBanner
          message={t('poolsLoadFailed')}
          onRetry={refresh}
          retryLabel={tc('retry')}
        />
      ) : null}

      {pools.length === 0 ? (
        <EmptyState text={t('noPools')} />
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
