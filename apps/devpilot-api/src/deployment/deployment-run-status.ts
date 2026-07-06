/**
 * DeploymentRun / SiteSyncRun 状态常量与类型联合。
 *
 * Prisma schema 里 `status String @default("running")`（非 enum），合法值只在注释里
 * （`queued | running | completed | failed | blocked | cancelled`）。
 * 这里提供命名常量与类型联合，避免散布的裸字符串字面量导致拼写错误。
 *
 * 不强制重写所有现有比较点（100+ 处，风险高）；新代码应使用本常量，
 * 存量比较点可按需迁移。Prisma 字段类型仍是 `string`，常量值与之一致。
 */
export const DeploymentRunStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BLOCKED: 'blocked',
  CANCELLED: 'cancelled',
} as const;

export type DeploymentRunStatusValue =
  (typeof DeploymentRunStatus)[keyof typeof DeploymentRunStatus];

/** 终态：不再变化的 status。 */
export const TERMINAL_DEPLOYMENT_RUN_STATUSES: readonly DeploymentRunStatusValue[] = [
  DeploymentRunStatus.COMPLETED,
  DeploymentRunStatus.FAILED,
  DeploymentRunStatus.CANCELLED,
] as const;

export function isTerminalDeploymentRunStatus(status: string): boolean {
  return (TERMINAL_DEPLOYMENT_RUN_STATUSES as readonly string[]).includes(status);
}

/**
 * DeploymentRun 合法状态转换表。
 *
 * `created` 是 smoke 子流程的状态（不参与主 run 转换）；主 run 的生命周期：
 * `queued → running → completed | failed`，外加 `→ blocked`（待审批）与
 * `→ cancelled`（取消）。`running` 在审批通过后可从 `blocked` 进入。
 */
const DEPLOYMENT_RUN_TRANSITIONS: ReadonlyMap<string, readonly string[]> = new Map([
  [DeploymentRunStatus.QUEUED, [DeploymentRunStatus.BLOCKED, DeploymentRunStatus.RUNNING, DeploymentRunStatus.CANCELLED, DeploymentRunStatus.FAILED]],
  [DeploymentRunStatus.BLOCKED, [DeploymentRunStatus.RUNNING, DeploymentRunStatus.CANCELLED, DeploymentRunStatus.FAILED]],
  [DeploymentRunStatus.RUNNING, [DeploymentRunStatus.COMPLETED, DeploymentRunStatus.FAILED, DeploymentRunStatus.CANCELLED]],
]);

/**
 * 断言一次状态转换合法。非法转换抛出 Error（带 from→to 上下文）。
 *
 * 终态转换（to === from，或 from 已是终态）视为合法（幂等写入）。
 * 在状态写入点调用以拦截非法转换（如 `completed → running`）。
 */
export function assertDeploymentRunTransition(from: string, to: string): void {
  if (from === to) return;
  // 新建 run（from 为空/undefined，尚未持久化状态）的初始转换视为合法。
  if (!from) return;
  if (isTerminalDeploymentRunStatus(from)) {
    throw new Error(`illegal deployment run transition: ${from} -> ${to} (terminal status)`);
  }
  const allowed = DEPLOYMENT_RUN_TRANSITIONS.get(from);
  if (!allowed || !allowed.includes(to)) {
    throw new Error(`illegal deployment run transition: ${from} -> ${to}`);
  }
}

/** 是否为合法转换（不抛错，供条件判断用）。 */
export function canTransitionDeploymentRun(from: string, to: string): boolean {
  try {
    assertDeploymentRunTransition(from, to);
    return true;
  } catch {
    return false;
  }
}
