'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatDateTimeMinute } from '@/lib/format-date';
import { ReleaseOrderActions } from '../[id]/components/release-order-actions';
import type { ProjectDirectoryItem } from '../types';
import {
  directoryComponentLabel,
  environmentReadyFor,
  type DirectoryEnvColumn,
} from './project-directory-columns.model';

const PROJECT_TYPE_LABELS: Record<string, string> = {
  web_application: 'projectTypeWebApplication',
  backend_service: 'projectTypeBackendService',
  static_site: 'projectTypeStaticSite',
  mixed_application: 'projectTypeMixedApplication',
};

const ARCHITECTURE_LABELS: Record<string, string> = {
  monorepo: 'architectureMonorepo',
  single_repository: 'architectureSingleRepository',
};

export function ProjectDirectoryRow({
  project,
  envColumns,
}: {
  project: ProjectDirectoryItem;
  envColumns: DirectoryEnvColumn[];
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const base = `/projects/${project.id}`;

  // 项目列副行仅保留形态元信息（类型 · 架构）；组件明细在「组件」列。
  const intakeFacts = [
    project.intake.projectType ? t(PROJECT_TYPE_LABELS[project.intake.projectType] as never) : null,
    project.intake.architecture ? t(ARCHITECTURE_LABELS[project.intake.architecture] as never) : null,
  ].filter(Boolean);

  const actions = [
    ...(project.nextAction
      ? [
          {
            key: 'fix',
            label: t('projectDeliveryFixNow'),
            onSelect: () => router.push(project.nextAction!.href),
          },
        ]
      : []),
    { key: 'open', label: t('enterProject'), onSelect: () => router.push(base) },
    {
      key: 'releases',
      label: t('workbenchTabReleases'),
      onSelect: () => router.push(`${base}?view=releases`),
    },
    {
      key: 'configuration',
      label: t('workbenchTabConfiguration'),
      onSelect: () => router.push(`${base}/settings`),
    },
    {
      key: 'domains',
      label: t('workbenchTabDomains'),
      onSelect: () => router.push(`${base}/domains`),
    },
  ];

  return (
    <tr className="hover:bg-muted/20">
      {/* 项目：名称链接（正常字重）+ 形态副行；无 icon、无仓库地址。 */}
      <td className="max-w-0 px-4 py-3">
        <Link
          href={base}
          className="text-sm text-primary hover:underline"
        >
          {project.name}
        </Link>
        {intakeFacts.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {intakeFacts.join(' · ')}
          </p>
        ) : null}
      </td>
      {/* 状态：纯文案 + 色值（不套标签）。 */}
      <td className="px-4 py-3">
        <span
          className={
            project.status === 'online'
              ? 'text-sm text-emerald-700'
              : 'text-sm text-amber-700'
          }
        >
          {t(project.status === 'online' ? 'statusOnline' : 'statusNeedsConfiguration')}
        </span>
      </td>
      {/* 组件：列整体收窄，单元格截断；hover 气泡一行一个组件，
          气泡可移入（antd 式：内部 padding 做悬停桥，无外部间隙）。 */}
      <td className="max-w-[8.5rem] px-4 py-3 text-xs text-muted-foreground">
        {project.components.length > 0 ? (
          <span className="group relative block">
            <span className="block truncate font-mono">
              {directoryComponentLabel(project.components)}
            </span>
            <span className="absolute left-0 top-full z-40 hidden w-max min-w-40 pt-1 group-hover:block group-focus-within:block">
              <span className="block rounded-md border bg-popover p-2 shadow-md">
                {project.components.map((component) => (
                  <span
                    key={component.name}
                    className="block whitespace-nowrap font-mono leading-5 text-foreground"
                  >
                    {component.port !== null ? `${component.name}:${component.port}` : component.name}
                  </span>
                ))}
              </span>
            </span>
          </span>
        ) : (
          '—'
        )}
      </td>
      {/* 线上版本：生产当前生效版本 + 生产域名。 */}
      <td className="px-4 py-3 text-sm">
        <span className="font-medium">{project.production.currentVersion ?? '—'}</span>
        {project.production.domain ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {project.production.domain}
          </p>
        ) : null}
      </td>
      {/* 最新发布时间：各环境当前版本生效时间的最大值。 */}
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
        {project.latestReleaseAt ? formatDateTimeMinute(project.latestReleaseAt) : '—'}
      </td>
      {envColumns.map((column) => (
        <EnvironmentVersionCell
          key={column.key}
          project={project}
          column={column}
        />
      ))}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <ReleaseOrderActions
          actions={actions}
          moreLabel={t('releaseOrderMoreActions')}
        />
      </td>
    </tr>
  );
}

function EnvironmentVersionCell({
  project,
  column,
}: {
  project: ProjectDirectoryItem;
  column: DirectoryEnvColumn;
}) {
  const t = useTranslations('projects');
  const environment = project.environments.find((item) => item.key === column.key);
  const version = environment?.currentVersion ?? null;
  const ready = environmentReadyFor(project, environment?.id ?? '');
  const href = `/projects/${project.id}/settings?section=environments&env=${encodeURIComponent(column.key)}`;
  const title = ready === null
    ? `${column.name}: ${version ?? t('directoryEnvNoVersion')}`
    : `${column.name}: ${version ?? t('directoryEnvNoVersion')} · ${
        ready ? t('directoryEnvBaselineReady') : t('directoryEnvBaselineNotReady')
      }`;
  return (
    <td className="whitespace-nowrap px-4 py-3 text-sm">
      <Link
        href={href}
        title={title}
        className="inline-flex items-center gap-1.5 text-foreground hover:text-primary hover:underline"
      >
        {ready !== null ? (
          <span
            aria-hidden="true"
            className={`inline-block size-2 rounded-full ${
              ready ? 'bg-emerald-500' : 'bg-muted-foreground/40'
            }`}
          />
        ) : null}
        <span className={version ? '' : 'text-muted-foreground'}>
          {version ?? '—'}
        </span>
      </Link>
    </td>
  );
}
