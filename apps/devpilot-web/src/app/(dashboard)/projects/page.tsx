import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EmptyState, Tag } from '@svton/ui';
import { PageHeader } from '@/components/ui';
import { serverRequest } from '@/lib/api-client/server';

import {
  getProjectDescription,
  getProjectManagementScopeLabel,
  getProjectOriginLabel,
  getProjectRepository,
  getProjectStackTags,
  getProjectSubProjectLabels,
} from '@/lib/project-display';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

interface Project {
  id: string;
  name: string;
  description: string | null;
  gitRepo: string | null;
  createdAt: string;
  config: unknown;
}

export default async function ProjectsPage() {
  const t = await getTranslations('projects');
  let projects: Project[] = [];
  try {
    projects = await serverRequest<Project[]>('GET:/projects');
  } catch (error) {
    console.error('Failed to load projects:', error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/projects/import"
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t('importExisting')}
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('createNew')}
            </Link>
          </div>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          text={t('noProjects')}
          description={t('noProjectsDescription')}
          action={
            <div className="flex gap-3">
              <Link
                href="/projects/import"
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {t('importExisting')}
              </Link>
              <Link
                href="/projects/new"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t('createNew')}
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              hasGitRepoLabel={t('hasGitRepo')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, hasGitRepoLabel }: { project: Project; hasGitRepoLabel: string }) {
  const description = getProjectDescription(project.config, project.description);
  const tags = [
    ...getProjectSubProjectLabels(project.config),
    ...getProjectStackTags(project.config),
  ];
  const repository = getProjectRepository(project.config, project.gitRepo);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold">{project.name}</h3>
        <Tag color="default">{getProjectOriginLabel(project.config)}</Tag>
      </div>
      <div className="mt-2">
        <Tag color="cyan">{getProjectManagementScopeLabel(project.config)}</Tag>
      </div>
      {description ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Tag
              key={tag}
              color="default"
            >
              {tag}
            </Tag>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{new Date(project.createdAt).toLocaleDateString('zh-CN')}</span>
        {repository ? <span className="text-primary">{hasGitRepoLabel}</span> : null}
      </div>
    </Link>
  );
}
