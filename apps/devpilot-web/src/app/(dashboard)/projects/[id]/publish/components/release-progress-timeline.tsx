/**
 * 发布进度时间线（第 0 步）
 *
 * 单一职责：渲染四步时间线（发布前检查 → 构建 → 预发部署 → 生产发布），
 * 每步三态 + 进行中耗时 + 失败人话原因与重试；等待审批给直达审批入口链接；
 * 发布前检查失败给项目设置深链（无重跑端点，见 preflightSettingsHref 注记）。
 */

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CheckCircle,
  CircleNotch,
  WarningCircle,
  Hourglass,
  CircleDashed,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui';
import type { ReleaseProgressStep } from './release-progress.model';
import { preflightSettingsHref } from './release-progress-status.model';
import { PublishErrorDetail } from './publish-error-detail';

const STEP_TITLE_KEYS = {
  preflight: 'progressStepPreflight',
  build: 'progressStepBuild',
  staging: 'progressStepStaging',
  production: 'progressStepProduction',
} as const;

interface Props {
  projectId: string;
  steps: ReleaseProgressStep[];
  onRetry: (stepId: ReleaseProgressStep['id']) => void;
  retryingStep: string | null;
}

export function ReleaseProgressTimeline({ projectId, steps, onRetry, retryingStep }: Props) {
  const t = useTranslations('projects');
  return (
    <ol
      className="space-y-3"
      aria-label={t('progressTitle')}
    >
      {steps.map((step) => (
        <li
          key={step.id}
          className={`rounded-lg border p-4 ${
            step.status === 'failed'
              ? 'border-destructive/40 bg-destructive/5'
              : step.status === 'running' || step.status === 'awaiting_approval'
                ? 'border-primary/40 bg-primary/5'
                : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="shrink-0"
            >
              {stepIcon(step.status)}
            </span>
            <span className="font-medium">{t(STEP_TITLE_KEYS[step.id])}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {t(STATUS_TEXT_KEYS[step.status])}
              {step.status === 'running' || step.status === 'awaiting_approval'
                ? elapsed(step, t)
                : null}
            </span>
          </div>
          {step.status === 'failed' ? (
            <div className="mt-2 space-y-2 pl-8 text-sm">
              {step.reasonText ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('progressReasonPrefix')}</p>
                  <PublishErrorDetail raw={step.reasonText} />
                </div>
              ) : (
                <p className="text-destructive">
                  {t('progressReasonPrefix')}
                  {t(REASON_CODE_KEYS[step.reasonCode ?? ''] ?? 'progressUnknownReason')}
                </p>
              )}
              {step.id === 'build' || step.id === 'staging' ? (
                <Button
                  className="min-h-11"
                  variant="outline"
                  loading={retryingStep === step.id}
                  disabled={retryingStep !== null}
                  onClick={() => onRetry(step.id)}
                >
                  {t('progressRetry')}
                </Button>
              ) : null}
              {step.id === 'preflight' ? (
                <p className="text-xs text-muted-foreground">
                  <Link
                    href={preflightSettingsHref(projectId, step.reasonCode)}
                    className="text-primary underline underline-offset-2"
                  >
                    {t('progressPreflightSettingsLink')}
                  </Link>
                </p>
              ) : null}
              {step.id === 'production' ? (
                <p className="text-xs text-muted-foreground">{t('progressProductionRetryHint')}</p>
              ) : null}
            </div>
          ) : null}
          {step.status === 'awaiting_approval' ? (
            <p className="mt-2 pl-8 text-sm text-muted-foreground">
              {t('progressApprovalPending')}{' '}
              <Link
                href={step.approvalHref ?? '/operation-approvals?status=pending&targetType=release_stage'}
                className="text-primary underline underline-offset-2"
              >
                {t('progressApprovalLink')}
              </Link>
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function stepIcon(status: ReleaseProgressStep['status']) {
  if (status === 'succeeded')
    return (
      <CheckCircle
        size={20}
        weight="fill"
        className="text-green-600"
      />
    );
  if (status === 'running' || status === 'awaiting_approval')
    return status === 'running' ? (
      <CircleNotch
        size={20}
        weight="bold"
        className="text-indigo-600"
      />
    ) : (
      <Hourglass
        size={20}
        weight="bold"
        className="text-indigo-600"
      />
    );
  if (status === 'failed')
    return (
      <WarningCircle
        size={20}
        weight="fill"
        className="text-destructive"
      />
    );
  return (
    <CircleDashed
      size={20}
      className="text-slate-400"
    />
  );
}

const STATUS_TEXT_KEYS: Record<ReleaseProgressStep['status'], string> = {
  pending: 'progressStatusPending',
  running: 'progressStatusRunning',
  succeeded: 'progressStatusSucceeded',
  failed: 'progressStatusFailed',
  awaiting_approval: 'progressStatusAwaitingApproval',
};

const REASON_CODE_KEYS: Record<string, string> = {
  preflight_repository: 'progressPreflightRepository',
  preflight_staging: 'progressPreflightStaging',
  preflight_production: 'progressPreflightProduction',
  approval_rejected: 'progressApprovalRejected',
};

/** 进行中耗时（从 startedAt 到当前）。终态由后端 finishedAt 决定，不在本组件展示。 */
function elapsed(step: ReleaseProgressStep, t: ReturnType<typeof useTranslations<'projects'>>) {
  if (!step.startedAt) return '';
  const start = Date.parse(step.startedAt);
  if (Number.isNaN(start)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const text =
    minutes >= 60
      ? t('progressElapsedHours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
      : minutes > 0
        ? t('progressElapsedMinutes', { minutes, seconds: seconds % 60 })
        : t('progressElapsedSeconds', { seconds });
  return ` · ${text}`;
}
