/**
 * 最近部署事件(N4)
 *
 * 单一职责:取最近部署运行,用作监控指标 sparkline 上的部署虚线标注。
 * 复用 dashboard 页同款端点 GET:/deployments/runs,SWR key 与之相同,
 * 因此与 dashboard 页共享缓存(同一会话只发一次请求)。
 *
 * 后端 listRuns 已按 startedAt desc 限 30 条;前端不再排序。
 * 字段为后端响应子集(向后兼容,新增字段不影响)。
 */
import { useQueryLoose } from '@/hooks/api/use-api';

/** 部署运行(用于事件虚线渲染的最小子集)。 */
export interface DeploymentEventRun {
  id: string;
  status: string;
  branch?: string | null;
  commitSha?: string | null;
  trigger?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  actor?: { id: string; name: string | null; email: string | null } | null;
  project?: { id: string; name: string } | null;
  projectEnvironment?: { id: string; key: string; name: string; status: string } | null;
}

/** 返回最近部署运行(可能为空数组;加载中也为空数组,调用方按需忽略)。 */
export function useRecentDeploymentEvents(): DeploymentEventRun[] {
  const { data } = useQueryLoose<DeploymentEventRun[]>('GET:/deployments/runs');
  return data ?? [];
}
