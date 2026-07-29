/** 项目详情域 - 发布阶段与依赖类型（F383）。
 *  单一职责：阶段（stage）、阶段间依赖边。 */
import type {
  ReleaseStageOutputSchema,
  ReleaseStageAttempt,
} from "./release-attempt.types";

/** 阶段间依赖边。 */
export interface ReleaseStageDependency {
  id: string;
  stageId: string;
  dependsOnStageId: string;
  conditionType: string;
  conditionSnapshot?: Record<string, unknown> | null;
}

/** 发布阶段。 */
export interface ReleaseStage {
  id: string;
  releasePlanId: string;
  key: string;
  name: string;
  type: string;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  applicationServiceName?: string | null;
  environmentId?: string | null;
  /** 真实目标服务器（builder 已写入 stage）。 */
  serverId?: string | null;
  executorKind: string;
  configHash?: string | null;
  /** 输入快照（builder 写入的 stage 级配置，含 command/branch/commitSha 等）。 */
  configSnapshot?: Record<string, unknown> | null;
  /** 该阶段产出的结构契约（可选，仅用于展示）。 */
  outputSchema?: ReleaseStageOutputSchema | null;
  riskLevel: string;
  required: boolean;
  status: string;
  blockedReason?: string | null;
  currentAttempt: number;
  /** Git 版本（builder 写入，便于阶段卡片展示真实目标）。 */
  branch?: string | null;
  commitSha?: string | null;
  gitRepo?: string | null;
  dependencies?: ReleaseStageDependency[];
  attempts?: ReleaseStageAttempt[];
  createdAt: string;
  updatedAt: string;
}
