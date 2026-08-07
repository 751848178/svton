/**
 * 环境配置摘要区
 *
 * 单一职责：渲染 Demo 对齐的 env-summary 四项事实（环境角色/部署目标/当前版本/保护等级）
 * 与 config-revision 条（当前生效配置 R{n} · 日期 + 不可变身份 key · 角色 · 发布顺序锁定）。
 *
 * 事实数据只使用 API 诚实提供的内容；「当前版本/部署次数」属于运行状态，
 * 以明确标注 + 深链引到环境版本/部署记录视图，不混入配置状态（AC-SET-007）。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import type { ProjectEnvironment } from '../../types';
import { environmentRoleLabelKey } from './settings-env.model';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentSettingsSummaryProps {
  environment: ProjectEnvironment;
  revision: EnvironmentConfigRevision | null;
  policyCount: number;
  deploymentRunCount: number;
  versionsHref: string;
  deploymentsHref: string;
}

export function EnvironmentSettingsSummary({
  environment,
  revision,
  policyCount,
  deploymentRunCount,
  versionsHref,
  deploymentsHref,
}: EnvironmentSettingsSummaryProps) {
  const t = useTranslations('projects');
  const roleKey = environmentRoleLabelKey(environment);
  const bindings = environment.serverBindings ?? [];
  const identityKey = environment.identityLockedAt
    ? 'configOrderLocked'
    : 'configOrderLocksAfterDeploy';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label={t('envSummaryRole')} value={t(roleKey)} />
        <Fact
          label={t('envSummaryTarget')}
          value={
            bindings.length > 0
              ? t('envSummaryTargetValue', { count: bindings.length })
              : t('envSummaryTargetEmpty')
          }
        />
        <div>
          <dt className="text-xs text-muted-foreground">{t('envSummaryCurrentVersion')}</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">
              {t('envDeployRunCount', { count: deploymentRunCount })}
            </span>
            <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
              {t('envSummaryRuntimeHint')}
            </span>
          </dd>
          <dd className="mt-1 flex flex-wrap gap-x-3 text-xs">
            <a className="text-primary hover:underline" href={versionsHref}>
              {t('envViewVersions')}
            </a>
            <a className="text-primary hover:underline" href={deploymentsHref}>
              {t('envViewDeployments')}
            </a>
          </dd>
        </div>
        <Fact
          label={t('envSummaryProtection')}
          value={
            policyCount > 0
              ? t('envProtectionPolicies', { count: policyCount })
              : t('envProtectionEmpty')
          }
        />
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-xs">
        <div>
          <span className="text-muted-foreground">{t('configRevisionStripLabel')}</span>
          <b className="ml-2 font-medium">
            {revision
              ? `R${revision.revision} · ${formatDateTimeMinute(revision.createdAt)}`
              : t('configRevisionStripNone')}
          </b>
        </div>
        <div>
          <span className="text-muted-foreground">{t('configRevisionIdentityLabel')}</span>
          <b className="ml-2 font-medium">
            {environment.key} · {t(roleKey)} · {t(identityKey)}
          </b>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
