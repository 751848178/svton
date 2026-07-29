/**
 * F383 发布初始化证据桥接 — 内部类型。
 *
 * 背景：releaseApplicationOnly=true 会让 application_deploy 阶段的 DeploymentRun
 * 不再在命令计划里执行 migration/bootstrap（它们已作为独立的 release 阶段执行）。
 * 但 DeploymentService 仍会为该服务/环境/命令指纹 reserve 一次 F382 初始化检查点，
 * 并在 run 结束时要求命令计划里存在 initialization 步骤证据——这与 releaseApplicationOnly
 * 互斥，导致成功部署被改写为 failed。
 *
 * 本桥接通过「发布 bootstrap 阶段成功后形成的可验证初始化证据引用」解决该互斥：
 * 证据不传前端布尔值，只传内部引用；DeploymentService/CheckpointService 必须从数据库
 * 重新读取并验证证据（scope、fingerprint、阶段类型、成功状态全部匹配）才视为已完成。
 *
 * 任何错误（plan/stage/env/service/fingerprint 不匹配或 bootstrap attempt 未成功）
 * 都必须 fail-closed，返回 "mismatch"，不得标记成功。
 */

/** 发布侧初始化证据引用（仅内部传递，不进公共 DTO / HTTP）。 */
export interface ReleaseInitializationEvidenceRef {
  teamId: string;
  projectId: string;
  environmentId: string;
  applicationServiceId: string;
  /** 发布 bootstrap 阶段所属计划。 */
  releasePlanId: string;
  /** 发布 bootstrap 阶段。 */
  releaseStageId: string;
  /** 发布 bootstrap 阶段成功的 attempt。 */
  releaseStageAttemptId: string;
  /** bootstrap attempt 关联的执行作业。 */
  serverExecutionJobId: string;
  /** bootstrap 初始化命令指纹（与 deployment.initializationCommand 同口径 sha256）。 */
  commandFingerprint: string;
}

/** 证据验证结论。 */
export type ReleaseInitializationEvidenceVerification =
  | {
      status: "verified";
      checkpointId: string;
    }
  | {
      status: "mismatch";
      reason: string;
    };

/** 验证时从数据库重新读取并校验的证据视图。 */
export interface VerifiedReleaseInitializationRow {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  applicationServiceId: string;
  commandFingerprint: string;
  status: string;
  releasePlanId: string | null;
  releaseStageId: string | null;
  releaseStageAttemptId: string | null;
  serverExecutionJobId: string | null;
}

/** 校验所需的最小 scope 输入（用于 mismatch 原因定位）。 */
export interface EvidenceScopeInput {
  teamId: string;
  projectId: string;
  environmentId: string;
  applicationServiceId: string;
  commandFingerprint: string;
}

/** 把发布 bootstrap 阶段成功的上下文映射为证据引用（适配器侧装配）。 */
export function buildReleaseInitializationEvidenceRef(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  applicationServiceId: string;
  releasePlanId: string;
  releaseStageId: string;
  releaseStageAttemptId: string;
  serverExecutionJobId: string;
  commandFingerprint: string;
}): ReleaseInitializationEvidenceRef {
  return { ...input };
}
