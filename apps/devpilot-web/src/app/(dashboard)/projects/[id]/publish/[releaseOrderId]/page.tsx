/**
 * 发布进度页（第 0 步，界面 B）
 *
 * 单条时间线：发布前检查 → 构建 → 预发部署 → 生产发布；运行中每 5s 轮询，
 * 终态停止。预发成功出现「发布到生产」（唯一人工闸口）；失败步骤给原因与
 * 重试；审批等待给入口链接；回滚一步可达（preview → confirm）。
 */

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { ReleaseProgressTimeline } from '../components/release-progress-timeline';
import { ReleaseProgressActions } from '../components/release-progress-actions';
import { useReleaseProgress } from '../hooks/use-release-progress';
import { useReleaseStepRetry } from '../hooks/use-release-step-retry';

export default function PublishProgressPage() {
  const params = useParams<{ id: string; releaseOrderId: string }>();
  const projectId = params.id;
  const releaseOrderId = params.releaseOrderId;
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const progress = useReleaseProgress(projectId, releaseOrderId);
  const retry = useReleaseStepRetry(projectId, releaseOrderId, progress.reload);

  const handleRetry = (stepId: 'preflight' | 'build' | 'staging' | 'production') => {
    if (stepId === 'build') return void retry.retryBuild();
    if (stepId === 'staging') return void retry.retryStagingDeploy();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={t('progressTitle')}
        description={
          progress.detail
            ? t('progressOrderSummary', { version: progress.detail.releaseVersion })
            : undefined
        }
        actions={
          <Link
            href={`/projects/${projectId}`}
            className="link text-sm"
          >
            {t('publishBackToProject')}
          </Link>
        }
      />
      {progress.error ? (
        <ErrorBanner
          message={progress.error}
          onRetry={() => void progress.reload()}
          retryLabel={tc('retry')}
        />
      ) : null}
      {retry.error ? (
        <ErrorBanner
          message={retry.error === 'NO_MANIFEST' ? t('publishRetryNoManifest') : retry.error}
        />
      ) : null}
      <ReleaseProgressTimeline
        steps={progress.steps}
        onRetry={handleRetry}
        retryingStep={retry.retrying}
      />
      {progress.productionSucceeded ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
          {t('progressFinished')}
        </p>
      ) : null}
      {progress.awaitingApproval ? (
        <p className="text-sm text-muted-foreground">
          {t('progressApprovalPending')}{' '}
          <Link
            href="/operation-approvals"
            className="text-primary underline underline-offset-2"
          >
            {t('progressApprovalLink')}
          </Link>
        </p>
      ) : null}
      <ReleaseProgressActions
        projectId={projectId}
        releaseOrderId={releaseOrderId}
        manifestId={progress.succeededManifestId}
        canPublishToProduction={progress.canPublishToProduction}
        canRollback={progress.canRollback}
        productionSucceeded={progress.productionSucceeded}
        onChanged={progress.reload}
      />
    </div>
  );
}
