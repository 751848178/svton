'use client';

import { Suspense as ReactSuspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSites } from './hooks/use-sites';
import { AddSiteModal } from './components/add-site-modal';
import { EditSiteModal } from './components/edit-site-modal';
import { FocusedSitePanel } from './components/focused-site-panel';
import { SiteListSection } from './components/site-list-section';

// React 19 类型下 Suspense 跨包 JSX 校验差异，用类型断言绕过（TS2786）
const Suspense = ReactSuspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => JSX.Element;

function SitesContent() {
  const t = useTranslations('sites');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const environmentId = searchParams.get('environmentId') || '';
  const siteId = searchParams.get('siteId') || '';
  const openCreateOnMount = searchParams.get('new') === 'true';
  const sites = useSites(projectId, environmentId, siteId, openCreateOnMount);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageManageTitle')}
        description={t('pageManageDescription')}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={sites.queueSiteRuns}
                onChange={(e) => sites.setQueueSiteRuns(e.target.checked)}
                className="h-5 w-5"
              />
              {t('queueSiteOps')}
            </label>
            <button
              onClick={() => sites.setShowModal(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('addSitePrefixed')}
            </button>
          </div>
        }
      />

      {projectId || environmentId ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {t('filterHint')}
        </div>
      ) : null}

      {sites.error ? (
        <ErrorBanner
          message={sites.error}
          onRetry={() => sites.reload()}
          retryLabel={tc('retry')}
        />
      ) : null}

      {!sites.loading && siteId && !sites.focusedSite && sites.sites.length > 0 ? (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          {t('siteNotInFilter')}
        </div>
      ) : null}

      {!sites.loading && sites.focusedSite ? <FocusedSitePanel sites={sites} /> : null}

      {sites.loading ? (
        <LoadingState text={tc('loading')} />
      ) : sites.sites.length === 0 ? (
        <EmptyState
          text={t('noSites')}
          description={t('noSitesDescription')}
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

      {sites.editTarget ? (
        <EditSiteModal
          site={sites.editTarget}
          servers={sites.servers}
          projects={sites.projects}
          projectEnvironments={sites.projectEnvironments}
          proxyConfigs={sites.proxyConfigs}
          onClose={() => sites.setEditTarget(null)}
          onSuccess={() => {
            sites.setEditTarget(null);
            sites.reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(sites.deleteTarget)}
        onOpenChange={(open) => {
          if (!open) sites.cancelDelete();
        }}
        tone="danger"
        title={t('deleteSiteTitle')}
        description={
          sites.deleteTarget
            ? t('deleteSiteDescription', { name: sites.deleteTarget.name })
            : undefined
        }
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={sites.confirmDelete}
      />

      <ConfirmDialog
        open={Boolean(sites.pendingLiveAction)}
        onOpenChange={(open) => {
          if (!open) sites.cancelPendingLiveAction();
        }}
        tone="warning"
        title={
          sites.pendingLiveAction?.kind === 'tlsRenew'
            ? t('confirmTlsRenewTitle')
            : sites.pendingLiveAction?.kind === 'rollback'
              ? t('confirmRollbackTitle')
              : t('confirmSyncTitle')
        }
        description={
          sites.pendingLiveAction
            ? sites.pendingLiveAction.kind === 'tlsRenew'
              ? t('confirmTlsRenewDescription', { name: sites.pendingLiveAction.site.name })
              : sites.pendingLiveAction.kind === 'rollback'
                ? t('confirmRollbackDescription', { name: sites.pendingLiveAction.site.name })
                : t('confirmSyncDescription', { name: sites.pendingLiveAction.site.name })
            : undefined
        }
        confirmLabel={tc('confirm')}
        cancelLabel={tc('cancel')}
        onConfirm={sites.confirmPendingLiveAction}
      />
    </div>
  );
}

export default function SitesPage() {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<LoadingState text={tc('loading')} />}>
      <SitesContent />
    </Suspense>
  );
}
