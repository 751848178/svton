/**
 * 发布进度时间线（第 0 步）
 *
 * 单一职责：渲染四步时间线（发布前检查 → 构建 → 预发部署 → 生产发布），
 * 每步三态 + 进行中耗时 + 失败人话原因与重试；等待审批给入口链接，无断链。
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

const STEP_TITLE_KEYS = {
  preflight: 'progressStepPreflight',
  build: 'progressStepBuild',
  staging: 'progressStepStaging',
  production: 'progressStepProduction',
} as const;

interface Props {
  steps: ReleaseProgressStep[];
  onRetry: (stepId: ReleaseProgressStep['id']) => void;
  retryingStep: string | null;
}

export function ReleaseProgressTimeline({ steps, onRetry, retryingStep }: Props) {
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
              {step.status === 'succeeded' ? (
                <CheckCircle
                  size={20}
                  weight="fill"
                  className="text-green-600"
                />
              ) : step.status === 'running' ? (
                <CircleNotch
                  size={20}
                  weight="bold"
                  className="text-indigo-600"
                />
              ) : step.status === 'awaiting_approval' ? (
                <Hourglass
                  size={20}
                  weight="bold"
                  className="text-indigo-600"
                />
              ) : step.status === 'failed' ? (
                <WarningCircle
                  size={20}
                  weight="fill"
                  className="text-destructive"
                />
              ) : (
                <CircleDashed
                  size={20}
                  className="text-slate-400"
                />
              )}
            </span>
            <span className="font-medium">{t(STEP_TITLE_KEYS[step.id])}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {statusText(step, t)}
              {step.status === 'running' || step.status === 'awaiting_approval'
                ? elapsed(step, t)
                : null}
            </span>
          </div>
          {step.status === 'failed' ? (
            <div className="mt-2 space-y-2 pl-8 text-sm">
              <p className="text-destructive">
                {t('progressReasonPrefix')}
                {step.reasonText || reasonCodeText(step.reasonCode, t)}
              </p>
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
              {step.id === 'production' ? (
                <p className="text-xs text-muted-foreground">{t('progressProductionRetryHint')}</p>
              ) : null}
            </div>
          ) : null}
          {step.status === 'awaiting_approval' ? (
            <p className="mt-2 pl-8 text-sm text-muted-foreground">
              {t('progressApprovalPending')}{' '}
              <Link
                href="/operation-approvals"
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

function statusText(step: ReleaseProgressStep, t: ReturnType<typeof useTranslations<'projects'>>) {
  if (step.status === 'succeeded') return t('progressStatusSucceeded');
  if (step.status === 'running') return t('progressStatusRunning');
  if (step.status === 'awaiting_approval') return t('progressStatusAwaitingApproval');
  if (step.status === 'failed') return t('progressStatusFailed');
  return t('progressStatusPending');
}

function reasonCodeText(code: string | null, t: ReturnType<typeof useTranslations<'projects'>>) {
  if (code === 'preflight_repository') return t('progressPreflightRepository');
  if (code === 'preflight_staging') return t('progressPreflightStaging');
  if (code === 'preflight_production') return t('progressPreflightProduction');
  if (code === 'approval_rejected') return t('progressApprovalRejected');
  return t('progressUnknownReason');
}

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
