/**
 * 发布向导页（第 0 步，界面 A）
 *
 * 页内三步：选环境 → 确认配置（生效配置表 + 冲突/密钥阻断）→ 确认发布。
 * 点击「发布」后自动完成 创建发布单 → 构建 → 部署预发，并跳转进度页。
 */

'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, ErrorBanner, PageHeader } from '@/components/ui';
import { PublishStepper } from './components/publish-stepper';
import { PublishEnvironmentStep } from './components/publish-environment-step';
import { PublishConfigStep } from './components/publish-config-step';
import { PublishConfirmStep } from './components/publish-confirm-step';
import { usePublishWizard } from './hooks/use-publish-wizard';

export default function PublishWizardPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const wizard = usePublishWizard(projectId);

  const publish = async (input: Parameters<typeof wizard.publish>[0]) => {
    const releaseOrderId = await wizard.publish(input);
    if (releaseOrderId) {
      router.push(`/projects/${projectId}/publish/${releaseOrderId}`);
    }
    return releaseOrderId;
  };
  const retryPublish = async (input: Parameters<typeof wizard.retryPublish>[0]) => {
    const releaseOrderId = await wizard.retryPublish(input);
    if (releaseOrderId) {
      router.push(`/projects/${projectId}/publish/${releaseOrderId}`);
    }
    return releaseOrderId;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={t('publishTitle')}
        description={t('publishDescription')}
        actions={
          <Link
            href={`/projects/${projectId}`}
            className="link text-sm"
          >
            {t('publishBackToProject')}
          </Link>
        }
      />
      <PublishStepper step={wizard.step} />
      <div className="rounded-lg border bg-card">
        <div className="space-y-4 p-5 sm:p-6">
          {wizard.environments.error ? (
            <ErrorBanner
              message={wizard.environments.error}
              onRetry={() => void wizard.environments.reload()}
              retryLabel={tc('retry')}
            />
          ) : null}
          {wizard.step === 1 ? (
            <PublishEnvironmentStep
              cards={wizard.environments.cards}
              loading={wizard.environments.loading}
              selectedId={wizard.selectedEnvironmentId}
              onSelect={wizard.selectEnvironment}
            />
          ) : null}
          {wizard.step === 2 ? (
            <PublishConfigStep
              projectId={projectId}
              environment={wizard.selectedEnvironment}
              config={wizard.config}
            />
          ) : null}
          {wizard.step === 3 ? (
            <PublishConfirmStep
              environment={wizard.selectedEnvironment}
              configCount={wizard.config.summary?.totalCount ?? 0}
              conflictCount={wizard.config.summary?.conflicts.length ?? 0}
              submitState={wizard.submit}
              onPublish={publish}
              onRetry={retryPublish}
            />
          ) : null}
        </div>
        {wizard.step < 3 ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">
            <span className="text-sm text-muted-foreground">
              {t('publishStepProgress', { step: wizard.step })}
            </span>
            <div className="flex gap-3">
              {wizard.step > 1 ? (
                <Button
                  className="min-h-11"
                  type="button"
                  variant="outline"
                  onClick={wizard.goBack}
                >
                  {tc('back')}
                </Button>
              ) : null}
              <Button
                className="min-h-11"
                type="button"
                disabled={!wizard.canAdvance}
                onClick={wizard.goNext}
              >
                {tc('next')}
              </Button>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
