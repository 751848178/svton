import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDate } from '@/lib/format-date';
import type { ProjectDirectoryItem } from '../types';

interface ProjectCardProps {
  project: ProjectDirectoryItem;
}

const ACTIVITY_LABELS = {
  analysis: 'activityAnalysis',
  deployment: 'activityDeployment',
  release: 'activityRelease',
  audit: 'activityAudit',
} as const;

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations('projects');
  const activity = project.activity[0];
  const productionDomain = project.domains[0]?.domain;

  return (
    <article className="rounded-lg border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{project.name}</h2>
            <StatusTag
              status={project.runtimeStatus}
              label={t(`runtime${capitalize(project.runtimeStatus)}`)}
            />
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {project.repository?.canonicalUrl ?? t('repositoryNotConnected')}
          </p>
          {project.description ? (
            <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{project.description}</p>
          ) : null}
        </div>

        <DirectoryCell label={t('directoryStructure')}>
          <p>{t('applicationServiceCount', project.counts)}</p>
          <p className="text-xs text-muted-foreground">
            {project.repository?.defaultBranch ?? t('branchNotDetected')}
          </p>
        </DirectoryCell>

        <DirectoryCell label={t('directoryBaselines')}>
          <div className="flex flex-wrap gap-1.5">
            <Tag color={project.baselines.staging ? 'cyan' : 'default'}>Staging</Tag>
            <Tag color={project.baselines.production ? 'green' : 'default'}>Production</Tag>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`configuration${configurationLabel(project.configurationStatus)}`)}
          </p>
        </DirectoryCell>

        <DirectoryCell label="Production">
          <p className="font-medium">
            {project.production?.currentVersion ?? t('productionNotReleased')}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {productionDomain ?? t('domainNotConfigured')}
          </p>
        </DirectoryCell>

        <div className="flex items-center justify-between gap-4 lg:block lg:min-w-40">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('directoryRecentActivity')}
            </p>
            <p className="mt-1 text-sm">
              {activity ? t(ACTIVITY_LABELS[activity.type]) : t('activityNone')}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(activity?.occurredAt ?? project.updatedAt)}
            </p>
          </div>
          <Link
            href={`/projects/${project.id}`}
            className="link whitespace-nowrap text-sm font-medium lg:mt-3 lg:inline-block"
          >
            {t('enterProject')} →
          </Link>
        </div>
      </div>
    </article>
  );
}

function DirectoryCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function configurationLabel(value: ProjectDirectoryItem['configurationStatus']) {
  if (value === 'needs_configuration') return 'NeedsConfiguration';
  if (value === 'in_progress') return 'InProgress';
  return capitalize(value);
}
