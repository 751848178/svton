/** 项目详情域 - 发布计划、事件、预览与能力类型（F383）。
 *  单一职责：计划顶层、事件、预览/创建请求契约、能力开关。 */
import type { ReleaseStage } from "./release-stage.types";

/** 发布计划。 */
export interface ReleasePlan {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  name: string;
  branch?: string | null;
  commitSha?: string | null;
  source: string;
  trigger: string;
  mode: string;
  status: string;
  blockedReason?: string | null;
  planHash?: string | null;
  inputSnapshot?: Record<string, unknown> | null;
  createdByUserId?: string | null;
  createdBy?: { id: string; name: string | null; email: string } | null;
  environment?: { id: string; key: string; name: string } | null;
  stages?: ReleaseStage[];
  events?: ReleaseEvent[];
  startedAt?: string | null;
  finishedAt?: string | null;
  canceledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 发布审计事件。 */
export interface ReleaseEvent {
  id: string;
  releasePlanId: string;
  releaseStageId?: string | null;
  stageAttemptId?: string | null;
  eventType: string;
  actorType: string;
  actorId?: string | null;
  correlationId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// 预览/创建请求里的服务选择器（P0-1：仅选择器字段——命令一律由服务端从
// ApplicationService.deployConfig 解析，客户端不再承载 shell 命令，杜绝「前端命令被信任」的 RCE 面）。
export interface ReleaseServiceInputItem {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string;
  serviceName: string;
}

/** 发布编排能力（GET /release-plans/capability）。enabled=false 禁用写动作；canCancel 恒真（逃生通道）。 */
export interface ReleaseCapability {
  enabled: boolean;
  canCancel: boolean;
  canWrite?: boolean | null;
  reason?: "flag_off" | "rbac" | null;
}
