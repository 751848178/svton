'use client';

import { Suspense as ReactSuspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader } from '@/components/ui';
import { useSites } from './hooks/use-sites';
import { AddSiteModal } from './components/add-site-modal';
import { FocusedSitePanel } from './components/focused-site-panel';
import { SiteListSection } from './components/site-list-section';

// React 19 类型下 Suspense 跨包 JSX 校验差异，用类型断言绕过（TS2786）
const Suspense = ReactSuspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => JSX.Element;

function SitesContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const environmentId = searchParams.get('environmentId') || '';
  const siteId = searchParams.get('siteId') || '';
  const openCreateOnMount = searchParams.get('new') === 'true';
  const sites = useSites(projectId, environmentId, siteId, openCreateOnMount);

  return (
    <div className="space-y-6">
      <PageHeader
        title="站点管控"
        description="以站点维度管理域名、运行时、TLS、访问策略和同步计划"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={sites.queueSiteRuns}
                onChange={(e) => sites.setQueueSiteRuns(e.target.checked)}
              />
              站点操作加入队列
            </label>
            <button
              onClick={() => sites.setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              + 添加站点
            </button>
          </div>
        }
      />

      {projectId || environmentId ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          当前按项目/环境筛选站点。清除浏览器地址中的 projectId 和 environmentId 可查看全部站点。
        </div>
      ) : null}

      {!sites.loading && siteId && !sites.focusedSite && sites.sites.length > 0 ? (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          链接中的站点不在当前筛选结果内，请确认项目/环境筛选条件是否匹配。
        </div>
      ) : null}

      {!sites.loading && sites.focusedSite ? <FocusedSitePanel sites={sites} /> : null}

      {sites.loading ? (
        <LoadingState text="加载中..." />
      ) : sites.sites.length === 0 ? (
        <EmptyState
          text="暂无站点"
          description="添加站点来管理域名、运行时与同步计划"
        />
      ) : (
        <SiteListSection sites={sites} />
      )}

      {sites.showModal ? (
        <AddSiteModal
          servers={sites.servers}
          projects={sites.projects}
          projectEnvironments={sites.projectEnvironments}
          proxyConfigs={sites.proxyConfigs}
          defaultProjectId={projectId}
          defaultEnvironmentId={environmentId}
          onClose={() => sites.setShowModal(false)}
          onSuccess={() => {
            sites.setShowModal(false);
            sites.reload();
          }}
        />
      ) : null}
    </div>
  );
}

export default function SitesPage() {
  return (
    <Suspense fallback={<LoadingState text="加载中..." />}>
      <SitesContent />
    </Suspense>
  );
}
