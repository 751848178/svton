'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  getProjectDescription,
  getProjectManagementScopeLabel,
  getProjectOriginLabel,
  getProjectRepository,
  getProjectStackTags,
  getProjectSubProjectLabels,
} from '@/lib/project-display';

interface Project {
  id: string;
  name: string;
  description: string | null;
  gitRepo: string | null;
  createdAt: string;
  config: unknown;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await api.get<Project[]>('/projects');
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">我的项目</h1>
          <p className="text-muted-foreground">查看和管理已创建或已接入的项目</p>
        </div>
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
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">还没有项目</h3>
          <p className="text-muted-foreground mt-2">
            可以创建一个全新项目，也可以先接入已有项目进入管控。
          </p>
          <div className="mt-6 flex justify-center gap-3">
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
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const description = getProjectDescription(project.config, project.description);
            const tags = [
              ...getProjectSubProjectLabels(project.config),
              ...getProjectStackTags(project.config),
            ];
            const repository = getProjectRepository(project.config, project.gitRepo);

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-lg">{project.name}</h3>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                    {getProjectOriginLabel(project.config)}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {getProjectManagementScopeLabel(project.config)}
                  </span>
                </div>
                {description && (
                  <p className="text-muted-foreground text-sm mt-2 line-clamp-2">
                    {description}
                  </p>
                )}
                {tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {new Date(project.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                  {repository && (
                    <span className="text-primary">
                      有 Git 仓库
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
