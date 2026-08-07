/**
 * 项目设置页
 *
 * 单一职责：以 Demo 对齐的左侧导航组织三个低频域——项目识别 / 环境配置 / 发布规则
 * （AC-SET-002）。资源 / Webhook / 项目资料不再是顶层平级分区，仅保留深链访问
 * （?section=resources|webhooks|general），并在内容区给出提示。
 */
'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LinkButton } from '@/components/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
import { useRepositoryAnalysis } from '../hooks/use-repository-analysis.hooks';
import { readSettingsSection, settingsHref, type SettingsSection } from '../utils/project-route.utils';
import { EnvironmentSettingsArea } from './settings/environment-settings-area';
import { ReleasePolicyTab } from './tabs/release-policy-tab';
import { RepositoryTab } from './tabs/repository-tab';
import { ResourcesTab } from './tabs/resources-tab';
import { SettingsTab } from './tabs/settings-tab';
import { WebhooksTab } from './tabs/webhooks-tab';

type DetailHook = ReturnType<typeof useProjectDetail>;

const TOP_AREAS: Array<{ key: SettingsSection; labelKey: string }> = [
  { key: 'repository', labelKey: 'settingsAreaIdentity' },
  { key: 'environments', labelKey: 'settingsAreaEnvironments' },
  { key: 'release-policy', labelKey: 'settingsAreaReleasePolicy' },
];

const LEGACY_SECTIONS: SettingsSection[] = ['resources', 'webhooks', 'general'];

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
  const isLegacy = LEGACY_SECTIONS.includes(section);

  const navigate = (next: SettingsSection) => {
    router.replace(settingsHref(projectId, next, searchParams), { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{t('settingsPageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('settingsPageDescription')}</p>
        </div>
        <LinkButton
          href={`/projects/${encodeURIComponent(projectId)}`}
          variant="outline"
        >
          {t('backToReleaseManagement')}
        </LinkButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav
          className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-1"
          aria-label={t('settingsPageTitle')}
        >
          {TOP_AREAS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              onClick={() => navigate(key)}
              aria-current={section === key ? 'page' : undefined}
              className={
                section === key
                  ? 'shrink-0 rounded-md bg-primary/10 px-3 py-2 text-left text-sm font-medium text-blue-800'
                  : 'shrink-0 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground'
              }
            >
              {t(labelKey)}
            </button>
          ))}
        </nav>

        <section className="min-w-0 space-y-4">
          {isLegacy ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {t('settingsLegacySectionHint')}
            </p>
          ) : null}
          {renderSection(section, {
            detail,
            analysis,
            projectId,
            onSelectAnalysisRun: (runId) => {
              const next = new URLSearchParams(searchParams);
              next.set('analysisRunId', runId);
              router.replace(settingsHref(projectId, 'repository', next), { scroll: false });
            },
          })}
        </section>
      </div>
    </div>
  );
}

function renderSection(
  section: SettingsSection,
  ctx: {
    detail: DetailHook;
    analysis: ReturnType<typeof useRepositoryAnalysis>;
    projectId: string;
    onSelectAnalysisRun: (runId: string) => void;
  },
) {
  const { detail, analysis, projectId, onSelectAnalysisRun } = ctx;
  switch (section) {
    case 'repository':
      return <RepositoryTab analysis={analysis} onSelectRun={onSelectAnalysisRun} />;
    case 'environments':
      return <EnvironmentSettingsArea detail={detail} />;
    case 'release-policy':
      return <ReleasePolicyTab projectId={projectId} />;
    case 'resources':
      return <ResourcesTab detail={detail} />;
    case 'webhooks':
      return <WebhooksTab detail={detail} />;
    case 'general':
      return <SettingsTab detail={detail} />;
  }
}
