import { getTranslations } from 'next-intl/server';
import { ApiError } from '@svton/api-client';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';

import type { ResourcePool } from './types';
import { ResourcePoolsContent } from './components/ResourcePoolsContent';
import {
  ResourcePoolsConfirmProvider,
  ResourcePoolsDeleteConfirmDialog,
} from './hooks/pool-delete-confirm';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 资源池管理 — Server Component。
 *
 * 首屏在服务端取数（走 cookie 鉴权），下发 initialPools 给客户端 ResourcePoolsContent（SWR fallback）。
 * 交互（新增/编辑/删除）由 ResourcePoolsContent 承担。
 *
 * 注意：server 取到空列表时不传 fallback（传 undefined），让客户端 SWR 走正常 loading 流程，
 * 避免空数组被当作「已有数据」而不发起请求。
 */
export default async function ResourcePoolsPage() {
  const t = await getTranslations('admin');
  let initialPools: ResourcePool[] | undefined;
  try {
    const data = await serverRequest<ResourcePool[]>('GET:/resource-pools');
    initialPools = data.length > 0 ? data : undefined;
  } catch (error) {
    redirectOnUnauthorized(error, '/admin/resource-pools');
    if (isAccessDeniedApiError(error)) {
      return (
        <ResourcePoolsLoadError
          title={t('poolsPageTitle')}
          description={t('poolsPageDescription')}
          message={t('poolsAccessDenied')}
        />
      );
    }
    console.error('Failed to load resource pools:', error);
    return (
      <ResourcePoolsLoadError
        title={t('poolsPageTitle')}
        description={t('poolsPageDescription')}
        message={t('poolsLoadFailed')}
      />
    );
  }

  return (
    <ResourcePoolsConfirmProvider>
      <ResourcePoolsContent initialPools={initialPools} />
      <ResourcePoolsDeleteConfirmDialog />
    </ResourcePoolsConfirmProvider>
  );
}

function isAccessDeniedApiError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 403 || error.code === '403');
}

function ResourcePoolsLoadError({
  title,
  description,
  message,
}: {
  title: string;
  description: string;
  message: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <ErrorBanner message={message} />
    </div>
  );
}
