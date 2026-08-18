/**
 * 发布向导第二步：确认配置（第 0 步）
 *
 * 单一职责：组装生效配置表 + 冲突/密钥阻断横幅；存在未解决冲突或未配置
 * 密钥时向页面声明不可进入下一步（禁用态与原因文案在此给出）。
 */

'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { settingsEnvironmentTabHref } from '../../utils/settings-environment-route';
import type { PublishEnvironmentCard } from '../hooks/use-publish-environments';
import type { useEffectiveConfig } from '../hooks/use-effective-config';
import { EffectiveConfigTable } from './effective-config-table';
import { EffectiveConfigConflictBanner } from './effective-config-conflict-banner';

interface Props {
  projectId: string;
  environment: PublishEnvironmentCard | null;
  config: ReturnType<typeof useEffectiveConfig>;
}

export function PublishConfigStep({ projectId, environment, config }: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const hrefs = useMemo(
    () => ({
      variablesHref: settingsEnvironmentTabHref(projectId, environment?.key ?? null, 'variables'),
      resourcesHref: settingsEnvironmentTabHref(projectId, environment?.key ?? null, 'resources'),
      keysHref: `/keys?projectId=${encodeURIComponent(projectId)}${
        environment ? `&environmentId=${encodeURIComponent(environment.id)}` : ''
      }`,
    }),
    [environment, projectId],
  );

  return (
    <section
      className="space-y-4"
      aria-label={t('publishStepConfig')}
    >
      <div>
        <h3 className="font-semibold">{t('publishConfigTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('publishConfigHint')}</p>
      </div>
      {config.loading ? (
        <LoadingState text={tc('loading')} />
      ) : config.error ? (
        <ErrorBanner
          message={config.error}
          onRetry={() => void config.reload()}
          retryLabel={tc('retry')}
        />
      ) : config.summary ? (
        <>
          <EffectiveConfigConflictBanner
            conflicts={config.summary.conflicts}
            unconfiguredSecrets={config.summary.unconfiguredSecrets}
            keysHref={hrefs.keysHref}
          />
          <EffectiveConfigTable
            rows={config.summary.rows}
            variablesHref={hrefs.variablesHref}
            resourcesHref={hrefs.resourcesHref}
            keysHref={hrefs.keysHref}
          />
          {config.blocking ? (
            <p className="text-sm text-amber-700">{t('publishConfigBlocked')}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
