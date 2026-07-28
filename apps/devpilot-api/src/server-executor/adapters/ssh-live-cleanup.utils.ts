import {
  ServerExecutionInput,
  ServerRemoteExecutionCleanup,
  ServerRemoteExecutionSession,
} from "../server-executor.types";

/**
 * 远端清理会话的校验与结果构造（F383 §A.3 统一 cleanup 路径）。
 *
 * 把 stale recovery 的「session/target 元数据是否可清理」与清理结果对象构造
 * 从 adapter 抽出，使 adapter 只负责编排（取凭据 → 建 transport → kill），
 * 校验文案与结果形状集中在这里，避免 execute/cleanup 两处重复。
 */

/** 清理结果的公共字段（transport/pid/observedAt/reason）。 */
export function buildSshCleanupBase(
  session: ServerRemoteExecutionSession,
  reason: ServerRemoteExecutionCleanup["reason"],
) {
  return {
    transport: "ssh" as const,
    pid: session.pid,
    observedAt: new Date().toISOString(),
    ...(reason ? { reason } : {}),
  };
}

/** session 元数据是否合法（SSH 传输 + 有效 pid）。 */
export function isSshCleanupSessionValid(
  session: ServerRemoteExecutionSession,
): boolean {
  return (
    session.transport === "ssh" &&
    Number.isSafeInteger(session.pid) &&
    session.pid > 1
  );
}

/** 目标是否携带 stale 清理所需要的 SSH serverId。 */
export function hasSshCleanupTarget(
  input: ServerExecutionInput,
): boolean {
  return input.target.transport === "ssh" && Boolean(input.target.serverId);
}

/** 构造「未尝试」的清理结果（元数据非法或目标缺失时）。 */
export function buildSshCleanupNotAttempted(
  base: ReturnType<typeof buildSshCleanupBase>,
  error: string,
): ServerRemoteExecutionCleanup {
  return { ...base, attempted: false, error };
}
