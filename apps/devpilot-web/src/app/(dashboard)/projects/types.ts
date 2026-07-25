/**
 * 项目列表页域类型
 *
 * 单一职责：声明项目列表页消费的最小字段集（GET:/projects 与 GET:/deployments/runs 的子集）。
 * 不耦合项目详情页的完整 Project 类型，列表页只关心展示与检索所需的字段。
 */

/**
 * GET:/projects 返回的项目（含 _count 聚合计数，后端 project.service findAll 已返回）。
 * config 为生成器/接入配置的原始记录，由 lib/project-display 的纯函数解析。
 */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  gitRepo: string | null;
  createdAt: string;
  config: unknown;
  /** 后端 Prisma _count 聚合：环境/应用计数。 */
  _count?: {
    environments?: number;
    applications?: number;
  };
}

/**
 * GET:/deployments/runs 返回的运行（列表页只消费展示最近部署状态所需的子集）。
 * 后端 runInclude() 已携带 project:{id,name}，故可按 projectId 客户端聚合。
 */
export interface ProjectDeploymentRun {
  id: string;
  status: string;
  startedAt: string;
  project?: { id: string; name: string } | null;
}

/** 来源筛选值（与 lib/project-display 的 ProjectOrigin 对齐）。 */
export type ProjectOriginFilter = 'all' | 'generated' | 'imported' | 'external';
