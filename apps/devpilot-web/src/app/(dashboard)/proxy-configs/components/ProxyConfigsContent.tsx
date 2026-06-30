'use client';

import { Suspense as ReactSuspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useBoolean } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader } from '@/components/ui';
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
export function ProxyConfigsContent({ initialConfigs }: { initialConfigs?: ProxyConfig[] }) {
  return (
    <Suspense fallback={<LoadingState text="加载中..." />}>
      <ProxyConfigsInner initialConfigs={initialConfigs} />
    </Suspense>
  );
}

function ProxyConfigsInner({ initialConfigs }: { initialConfigs?: ProxyConfig[] }) {
  const searchParams = useSearchParams();
  const openCreateOnMount = searchParams.get('new') === 'true';
  const { configs, servers, loading, syncingId, create, sync, remove } =
    useProxyConfigs(openCreateOnMount, initialConfigs);
  const [modalOpen, setModalOpen] = useState(openCreateOnMount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="代理配置"
        description="管理 Nginx 反向代理配置"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + 添加配置
          </button>
        }
      />

      {loading ? (
        <LoadingState text="加载中..." />
      ) : configs.length === 0 ? (
        <EmptyState
          text="还没有代理配置"
          description="添加代理配置来管理域名转发"
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
        onClose={() => setModalOpen(false)}
        onCreate={create}
      />
    </div>
  );
}
