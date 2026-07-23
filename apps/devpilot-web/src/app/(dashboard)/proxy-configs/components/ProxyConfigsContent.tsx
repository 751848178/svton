'use client';

import { Suspense as ReactSuspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBoolean } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useProxyConfigs } from '../hooks/use-proxy-configs';
import { ProxyConfigTable } from './proxy-config-table';
import { AddProxyConfigModal } from './add-proxy-config-modal';
import type { ProxyConfig } from '../types';

// React 19 类型下 Suspense 跨包 JSX 校验差异，用类型断言绕过（TS2786）
const Suspense = ReactSuspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => JSX.Element;

/**
 * 代理配置客户端视图。
 *
 * 接收首屏 server 数据 initialConfigs（SWR fallback），交互（新增/同步/删除）在此完成。
 * useSearchParams 必须包裹在 Suspense 边界内，故拆出 ProxyConfigsInner 由 Suspense 包住。
 */
export function ProxyConfigsContent({
  initialConfigs,
  initialError,
}: {
  initialConfigs?: ProxyConfig[];
  initialError?: string;
}) {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<LoadingState text={tc('loading')} />}>
      <ProxyConfigsInner initialConfigs={initialConfigs} initialError={initialError} />
    </Suspense>
  );
}

function ProxyConfigsInner({
  initialConfigs,
  initialError,
}: {
  initialConfigs?: ProxyConfig[];
  initialError?: string;
}) {
  const t = useTranslations('proxyConfigs');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const openCreateOnMount = searchParams.get('new') === 'true';
  const initialServerId = searchParams.get('serverId') || undefined;
  const { configs, servers, loading, error, syncingId, deleteTarget, create, sync, remove, cancelDelete, confirmDelete, reload } =
    useProxyConfigs(openCreateOnMount, initialConfigs, initialError);
  const [modalOpen, setModalOpen] = useState(openCreateOnMount);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <Button onClick={() => setModalOpen(true)}>
            {t('addConfig')}
          </Button>
        }
      />

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={reload}
          retryLabel={tc('retry')}
        />
      ) : null}

      {loading ? (
        <LoadingState text={tc('loading')} />
      ) : configs.length === 0 ? (
        <EmptyState
          text={t('noConfigs')}
          description={t('noConfigsHint')}
        />
      ) : (
        <ProxyConfigTable
          configs={configs}
          syncingId={syncingId}
          onSync={sync}
          onDelete={remove}
        />
      )}

      <AddProxyConfigModal
        open={modalOpen}
        servers={servers}
        initialServerId={initialServerId}
        onClose={() => setModalOpen(false)}
        onCreate={create}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) cancelDelete();
        }}
        tone="danger"
        title={t('deleteConfigTitle')}
        description={
          deleteTarget ? t('deleteConfigDescription', { name: deleteTarget.name }) : undefined
        }
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
