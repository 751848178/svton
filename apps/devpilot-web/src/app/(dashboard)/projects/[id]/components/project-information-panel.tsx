'use client';

import React from 'react';
import { Info } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useReleasePolicy } from '../hooks/use-release-policy';
import { useProjectDeliverySummary } from '../hooks/use-project-delivery-summary';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { ProjectComponentTable } from './project-component-table';
import { RepositoryTab } from './tabs/repository-tab';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectInformationPanel(props: {
  detail: DetailHook;
  analysis: RepositoryAnalysisHook;
  onSelectAnalysisRun: (runId: string) => void;
}) {
  const t = useTranslations('projects');
  const project = props.detail.project;
  const policy = useReleasePolicy(project?.id ?? '');
  if (!project) return null;
  const branch =
    props.analysis.state.canonicalIdentity?.effectiveRevision?.defaultBranch ??
    props.analysis.state.connection?.selectedBranch ??
    project.applications?.[0]?.defaultBranch ??
    '—';
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('projectInformationTitle')}</h2>
        {/* 基本信息区：排版承载分区，不用卡片容器（契约：排版优先于色块/边框）。 */}
        <dl className="grid gap-x-8 gap-y-4 border-b pb-5 text-sm md:grid-cols-3">
          <Fact
            label={t('repositoryLabel')}
            value={project.gitRepo || t('notLinked')}
            mono
          />
          <Fact
            label={t('defaultBranchLabel')}
            value={branch}
          />
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              {t('releasePolicyField')}
              {/* INFO-9：可视 tooltip（hover/focus 均可触发）与 aria-label 双写，
                  不再只依赖原生 title。 */}
              <span
                className="group relative inline-flex cursor-help"
                tabIndex={0}
                aria-label={t('releasePolicyFieldHelp')}
              >
                <Info
                  size={14}
                  aria-hidden="true"
                />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-64 -translate-y-1/2 rounded-md border bg-background px-2 py-1 text-xs normal-case text-foreground shadow-md group-hover:block group-focus:block"
                >
                  {t('releasePolicyFieldHelp')}
                </span>
              </span>
            </dt>
            <dd className="mt-1 font-medium">
              {policy.policy
                ? t(`releasePolicyStrategy${capitalize(policy.policy.current.strategy)}` as never)
                : '—'}
            </dd>
          </div>
        </dl>
      </section>
      <ReleaseEntrySection projectId={props.detail.project?.id || ''} />
      <ProjectComponentTable
        detail={props.detail}
        analysis={props.analysis}
      />
      <details className="rounded-lg border">
        <summary className="cursor-pointer px-5 py-4 text-sm font-medium">
          {t('repositoryAnalysisDetails')}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {t('repositoryAnalysisDetailsHint')}
          </span>
        </summary>
        <div className="border-t p-5">
          <RepositoryTab
            analysis={props.analysis}
            onSelectRun={props.onSelectAnalysisRun}
          />
        </div>
      </details>
    </div>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? 'mt-1 break-all font-mono text-xs' : 'mt-1 font-medium'}>{value}</dd>
    </div>
  );
}

function capitalize(value: string) {
  return value
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}

/**
 * 发布入口摘要区（IA：发布=独立工作台，项目详情提供显式入口而非 tab）。
 * 摘要行 + 「前往发布」链接；数据来自 delivery summary（无数据时仍提供入口）。
 */
function ReleaseEntrySection({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const delivery = useProjectDeliverySummary(projectId);
  const summary = delivery.summary;
  const checkpoint = summary?.checkpoints.find((item) => item.status !== 'ready');
  const blocker = checkpoint?.status === 'blocked';
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{t('informationReleaseEntryTitle')}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {blocker
            ? t('informationReleaseEntryBlocked')
            : t('informationReleaseEntryReady')}
        </p>
      </div>
      <Link
        href={`/projects/${encodeURIComponent(projectId)}/releases`}
        className="shrink-0 text-sm font-medium text-primary hover:underline"
      >
        {t('informationReleaseEntryLink')} →
      </Link>
    </section>
  );
}
