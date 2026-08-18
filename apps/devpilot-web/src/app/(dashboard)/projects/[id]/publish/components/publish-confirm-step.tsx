/**
 * 发布向导第三步：确认发布（第 0 步）
 *
 * 单一职责：一屏摘要（环境 / 配置条数与冲突数 / 发布版本意图）+ 主按钮「发布」。
 * 点击后由 use-publish-submit 编排（创建发布单 → 自动构建 → 自动部署预发），
 * 每段失败展示人话阶段原因与重试；成功后由页面跳转进度页。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Textarea } from '@/components/ui';
import type { CreateReleaseOrderInput } from '../../types/release-order.types';
import type { PublishEnvironmentCard } from '../hooks/use-publish-environments';
import type { PublishSubmitState } from '../hooks/use-publish-submit';

interface Props {
  environment: PublishEnvironmentCard | null;
  configCount: number;
  conflictCount: number;
  submitState: PublishSubmitState & { working: boolean };
  onPublish: (input: CreateReleaseOrderInput) => Promise<string | null>;
  onRetry: (input: CreateReleaseOrderInput) => Promise<string | null>;
}

export function PublishConfirmStep({
  environment,
  configCount,
  conflictCount,
  submitState,
  onPublish,
  onRetry,
}: Props) {
  const t = useTranslations('projects');
  const [releaseVersion, setReleaseVersion] = useState(suggestVersion());
  const [note, setNote] = useState('');
  const input: CreateReleaseOrderInput = {
    releaseVersion: releaseVersion.trim() || suggestVersion(),
    note: note.trim() || undefined,
  };
  const failed = submitState.failedStage !== null;

  return (
    <section
      className="space-y-4"
      aria-label={t('publishStepConfirm')}
    >
      <dl className="grid gap-2 text-sm">
        <div className="rounded-md bg-muted/40 p-3">
          <dt className="text-muted-foreground">{t('publishConfirmEnvironment')}</dt>
          <dd className="mt-1 font-medium">
            {environment ? `${environment.name} · ${roleText(environment.role, t)}` : '-'}
          </dd>
        </div>
        <div className="rounded-md bg-muted/40 p-3">
          <dt className="text-muted-foreground">{t('publishConfirmVariables')}</dt>
          <dd className="mt-1 font-medium">
            {t('publishConfirmVariableSummary', {
              count: configCount,
              conflicts: conflictCount,
            })}
          </dd>
        </div>
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('publishConfirmVersionLabel')}</span>
          <Input
            value={releaseVersion}
            onChange={(event) => setReleaseVersion(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('publishConfirmNoteLabel')}</span>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('publishConfirmNotePlaceholder')}
          />
        </label>
      </div>
      {submitState.working ? (
        <p
          className="text-sm text-muted-foreground"
          role="status"
        >
          {phaseText(submitState, t)}
        </p>
      ) : null}
      {failed ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2"
        >
          <p className="text-sm font-medium text-destructive">
            {stageText(submitState.failedStage, t)}
          </p>
          {submitState.error ? (
            <p className="mt-1 break-all text-xs text-destructive/90">{submitState.error}</p>
          ) : null}
          <Button
            className="mt-2 min-h-11"
            variant="outline"
            onClick={() => void onRetry(input)}
            disabled={submitState.working}
          >
            {t('publishRetryAction')}
          </Button>
        </div>
      ) : null}
      <Button
        className="min-h-11 w-full sm:w-auto"
        disabled={submitState.working || failed || !environment}
        onClick={() => void onPublish(input)}
      >
        {t('publishAction')}
      </Button>
    </section>
  );
}

function phaseText(state: PublishSubmitState, t: ReturnType<typeof useTranslations<'projects'>>) {
  if (state.phase === 'creating') return t('publishPhaseCreating');
  if (state.phase === 'building') return t('publishPhaseBuilding');
  if (state.phase === 'deploying') return t('publishPhaseDeploying');
  return t('publishAction');
}

function stageText(
  stage: PublishSubmitState['failedStage'],
  t: ReturnType<typeof useTranslations<'projects'>>,
) {
  if (stage === 'create') return t('publishFailedCreate');
  if (stage === 'build') return t('publishFailedBuild');
  if (stage === 'deploy') return t('publishFailedDeploy');
  return t('publishGenericError');
}

function roleText(
  role: PublishEnvironmentCard['role'],
  t: ReturnType<typeof useTranslations<'projects'>>,
) {
  if (role === 'staging') return t('publishEnvironmentRoleStaging');
  if (role === 'production') return t('publishEnvironmentRoleProduction');
  return t('publishEnvironmentRoleNone');
}

function suggestVersion(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('');
  return `release-${stamp}`;
}
