import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';
import { ProjectsContent } from './components/ProjectsContent';
import type { Project, ProjectDeploymentRun } from './types';

/** 该页在请求时读取 cookies() 鉴权，必须动态渲染。 */
export const dynamic = 'force-dynamic';

/**
 * 项目列表 — Server Component。
 *
 * 首屏并行取数（项目列表 + 全局最近部署运行），下发 initialProjects/initialRuns 给
 * 客户端 ProjectsContent（SWR fallback）。检索、最近部署聚合、卡片增强在客户端完成。
 *
 * runs 取数失败不阻断列表（latestRun 状态点退化为「暂无部署」），故独立 try/catch。
 */
export default async function ProjectsPage() {
  let initialProjects: Project[] | undefined;
  let initialRuns: ProjectDeploymentRun[] | undefined;
  let loadFailed = false;

  try {
    const projects = await serverRequest<Project[]>('GET:/projects');
    initialProjects = projects.length > 0 ? projects : undefined;
  } catch (error) {
    redirectOnUnauthorized(error, '/projects');
    console.error('Failed to load projects:', error);
    loadFailed = true;
  }

  // runs 失败不阻断列表；列表已失败时也不必再取 runs。
  if (!loadFailed) {
    try {
      const runs = await serverRequest<ProjectDeploymentRun[]>('GET:/deployments/runs');
      initialRuns = runs.length > 0 ? runs : undefined;
    } catch (error) {
      redirectOnUnauthorized(error, '/projects');
      console.error('Failed to load deployment runs for projects:', error);
    }
  }

  return (
    <ProjectsContent
      initialProjects={initialProjects}
      initialRuns={initialRuns}
      loadFailed={loadFailed}
    />
  );
}
