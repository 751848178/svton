import Link from 'next/link';
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
  let projects: Project[] = [];
  try {
    projects = await serverRequest<Project[]>('GET:/projects');
  } catch (error) {
    console.error('Failed to load projects:', error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="我的项目"
        description="查看和管理已创建或已接入的项目"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/projects/import"
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              接入已有项目
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              创建新项目
            </Link>
          </div>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          text="还没有项目"
          description="可以创建一个全新项目，也可以先接入已有项目进入管控。"
          action={
            <div className="flex gap-3">
              <Link
                href="/projects/import"
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                接入已有项目
              </Link>
              <Link
                href="/projects/new"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                创建新项目
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
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
        {repository ? <span className="text-primary">有 Git 仓库</span> : null}
      </div>
    </Link>
  );
}
