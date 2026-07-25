/**
 * 项目列表数据 Hook
 *
 * 单一职责：项目列表 + 最近部署聚合 + 前端检索。
 *
 * 数据源：
 * - GET:/projects —— 项目（含 _count.environments/applications）
 * - GET:/deployments/runs —— 全局最近部署运行（后端 runInclude 带 project:{id,name}，
 *   按 startedAt desc 限 30）。客户端按 run.project.id 聚合「每项目最新一条」。
 *
 * 检索为纯前端 filter（项目数通常 <100）：
 * - search：name/description 不区分大小写模糊匹配。
 * - originFilter：来源（生成/已有/外部/全部），复用 lib/project-display 的 getProjectOrigin。
 */

import { useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import { getProjectDescription, getProjectOrigin } from '@/lib/project-display';
import type { Project, ProjectDeploymentRun, ProjectOriginFilter } from '../types';

/** 聚合每个项目的最新部署运行（runs 已按 startedAt desc 返回，取首条即最新）。 */
function aggregateLatestRunByProject(
  runs: ProjectDeploymentRun[],
): Record<string, ProjectDeploymentRun> {
  const map: Record<string, ProjectDeploymentRun> = {};
  for (const run of runs) {
    const projectId = run.project?.id;
    if (!projectId || map[projectId]) continue;
    map[projectId] = run;
  }
  return map;
}

/** 项目是否命中搜索词（name 或 description，不区分大小写）。 */
function matchSearch(project: Project, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const description = getProjectDescription(project.config, project.description).toLowerCase();
  return project.name.toLowerCase().includes(needle) || description.includes(needle);
}

export interface UseProjectsResult {
  projects: Project[];
  filtered: Project[];
  latestRunByProject: Record<string, ProjectDeploymentRun>;
  search: string;
  setSearch: (value: string) => void;
  originFilter: ProjectOriginFilter;
  setOriginFilter: (value: ProjectOriginFilter) => void;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useProjects(
  initialProjects?: Project[],
  initialRuns?: ProjectDeploymentRun[],
): UseProjectsResult {
  const projectsSWR = useQueryLoose<Project[]>('GET:/projects', {
    fallback: initialProjects,
  });
  const runsSWR = useQueryLoose<ProjectDeploymentRun[]>('GET:/deployments/runs', {
    fallback: initialRuns,
  });

  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<ProjectOriginFilter>('all');

  const projects = useMemo(() => projectsSWR.data ?? [], [projectsSWR.data]);
  const runs = useMemo(() => runsSWR.data ?? [], [runsSWR.data]);

  const latestRunByProject = useMemo(() => aggregateLatestRunByProject(runs), [runs]);

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (!matchSearch(project, search.trim())) return false;
      if (originFilter !== 'all' && getProjectOrigin(project.config) !== originFilter) {
        return false;
      }
      return true;
    });
  }, [projects, search, originFilter]);

  // 首屏：列表源首次加载即视为加载中；runs 失败不阻断列表（latestRunByProject 退化为空）。
  const loading = projectsSWR.isLoading;
  const error = projectsSWR.error ?? null;

  const refresh = usePersistFn(() => {
    void projectsSWR.mutate();
    void mutate('GET:/deployments/runs');
  });

  return {
    projects,
    filtered,
    latestRunByProject,
    search,
    setSearch,
    originFilter,
    setOriginFilter,
    loading,
    error,
    refresh,
  };
}
