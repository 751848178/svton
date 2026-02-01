'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  gitRepo: string | null;
  createdAt: string;
  config: {
    projectName?: string;
    description?: string;
    subProjects?: string[];
  };
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">我的项目</h1>
          <p className="text-muted-foreground">查看和管理已创建的项目</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          创建新项目
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">还没有项目</h3>
          <p className="text-muted-foreground mt-2">
            点击上方按钮创建你的第一个项目
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-lg">{project.name}</h3>
              {project.config.description && (
                <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                  {project.config.description}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {project.config.subProjects?.map((sub) => (
                  <span
                    key={sub}
                    className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
                  >
                    {sub}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {new Date(project.createdAt).toLocaleDateString('zh-CN')}
                </span>
                {project.gitRepo && (
                  <span className="text-primary">
                    有 Git 仓库
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
