/**
 * 仪表盘域类型
 *
 * 单一职责：声明仪表盘消费的最小字段集。
 * 不跨页面 import 各功能域的完整类型，避免仪表盘与具体页面实现耦合；
 * 字段均为后端响应的子集（向后兼容，新增字段不影响）。
 */

/** 待审批操作（GET:/operation-approvals?status=pending 的子集）。 */
export interface DashboardApproval {
  id: string;
  status: string;
}

/** 项目（GET:/projects 的子集）。 */
export interface DashboardProject {
  id: string;
  name: string;
}

/** 资源申请（GET:/resource-requests 的子集）。 */
export interface DashboardResourceRequest {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

/** 部署运行（GET:/deployments/runs 的子集，含 runInclude 的 project）。 */
export interface DashboardDeploymentRun {
  id: string;
  status: string;
  branch: string | null;
  startedAt: string;
  finishedAt: string | null;
  project?: { id: string; name: string } | null;
  projectEnvironment?: { id: string; key: string; name: string; status: string } | null;
}

/** 告警事件（GET:/monitoring/alert-events 的子集）。 */
export interface DashboardAlertEvent {
  id: string;
  status: string;
  severity: string;
  summary?: string | null;
  occurredAt: string;
}
