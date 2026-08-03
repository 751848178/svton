'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs } from '@svton/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
import { useRepositoryAnalysis } from '../hooks/use-repository-analysis.hooks';
import { readSettingsSection, settingsHref } from '../utils/project-route.utils';
import { EnvironmentsTab } from './tabs/environments-tab';
import { RepositoryTab } from './tabs/repository-tab';
import { ResourcesTab } from './tabs/resources-tab';
import { SettingsTab } from './tabs/settings-tab';
import { WebhooksTab } from './tabs/webhooks-tab';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectSettingsContent({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = detail.project?.id ?? '';
  const section = readSettingsSection(searchParams);
  const analysis = useRepositoryAnalysis(
    projectId,
    searchParams.get('analysisRunId')?.trim() || undefined,
  );
  const items = [
    {
      key: 'repository',
      label: t('settingsSectionRecognition'),
      children: (
        <RepositoryTab
          analysis={analysis}
          onSelectRun={(runId) => {
            const next = new URLSearchParams(searchParams);
            next.set('analysisRunId', runId);
            router.replace(settingsHref(projectId, 'repository', next), { scroll: false });
          }}
        />
      ),
    },
    {
      key: 'environments',
      label: t('tabEnvironments'),
      children: (
        <EnvironmentsTab
          detail={detail}
          focusedEnvironmentId={searchParams.get('environmentId')?.trim() || undefined}
        />
      ),
    },
    { key: 'resources', label: t('tabResources'), children: <ResourcesTab detail={detail} /> },
    { key: 'webhooks', label: t('tabWebhooks'), children: <WebhooksTab detail={detail} /> },
    {
      key: 'general',
      label: t('settingsSectionGeneral'),
      children: <SettingsTab detail={detail} />,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('manageProjectDescription')}</p>
      <Tabs
        items={items}
        activeKey={section}
        onChange={(next) =>
          router.replace(settingsHref(projectId, next as typeof section, searchParams), {
            scroll: false,
          })
        }
      />
    </div>
  );
}
