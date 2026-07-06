/**
 * ResourceProvisioningRun 与 ResourceRequest 状态常量与类型联合。
 *
 * Prisma schema 里这些 status 是 `String`（非 enum），合法值散布在注释里。
 * 这里提供命名常量，避免裸字符串字面量拼写错误。
 *
 * 不强制重写所有现有比较点；新代码应使用本常量，存量按需迁移。
 */
export const ProvisioningRunStatus = {
  PLANNED: 'planned',
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BLOCKED: 'blocked',
  CANCELLED: 'cancelled',
  CANCELED: 'canceled', // 历史拼写兼容（部分流程用美式拼写）
} as const;

export type ProvisioningRunStatusValue =
  (typeof ProvisioningRunStatus)[keyof typeof ProvisioningRunStatus];

export const ResourceRequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  RELEASED: 'released',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  CANCELED: 'canceled',
} as const;

export type ResourceRequestStatusValue =
  (typeof ResourceRequestStatus)[keyof typeof ResourceRequestStatus];

/** 终态：不再变化的 provisioning run status。 */
export const TERMINAL_PROVISIONING_RUN_STATUSES: readonly ProvisioningRunStatusValue[] = [
  ProvisioningRunStatus.COMPLETED,
  ProvisioningRunStatus.FAILED,
  ProvisioningRunStatus.CANCELLED,
  ProvisioningRunStatus.CANCELED,
] as const;

export function isTerminalProvisioningRunStatus(status: string): boolean {
  return (TERMINAL_PROVISIONING_RUN_STATUSES as readonly string[]).includes(status);
}

/**
 * ResourceProvisioningRun 合法状态转换表。
 *
 * `planned → queued → running → completed | failed`，外加 `→ blocked`（待审批/外部依赖）
 * 与 `→ cancelled/canceled`（取消）。
 */
const PROVISIONING_RUN_TRANSITIONS: ReadonlyMap<string, readonly string[]> = new Map([
  // planned 可直接 completed（provider SDK reconciliation 确认已存在资源时跳过 queued/running）
  [ProvisioningRunStatus.PLANNED, [ProvisioningRunStatus.QUEUED, ProvisioningRunStatus.COMPLETED, ProvisioningRunStatus.CANCELLED, ProvisioningRunStatus.CANCELED, ProvisioningRunStatus.FAILED]],
  [ProvisioningRunStatus.QUEUED, [ProvisioningRunStatus.RUNNING, ProvisioningRunStatus.BLOCKED, ProvisioningRunStatus.CANCELLED, ProvisioningRunStatus.CANCELED, ProvisioningRunStatus.FAILED, ProvisioningRunStatus.COMPLETED]],
  [ProvisioningRunStatus.BLOCKED, [ProvisioningRunStatus.RUNNING, ProvisioningRunStatus.QUEUED, ProvisioningRunStatus.COMPLETED, ProvisioningRunStatus.CANCELLED, ProvisioningRunStatus.CANCELED, ProvisioningRunStatus.FAILED]],
  [ProvisioningRunStatus.RUNNING, [ProvisioningRunStatus.COMPLETED, ProvisioningRunStatus.FAILED, ProvisioningRunStatus.BLOCKED, ProvisioningRunStatus.CANCELLED, ProvisioningRunStatus.CANCELED]],
]);

/** 断言一次 provisioning run 状态转换合法，非法则抛错。 */
export function assertProvisioningRunTransition(from: string, to: string): void {
  if (from === to) return;
  if (!from) return; // 新建 run 的初始转换
  if (isTerminalProvisioningRunStatus(from)) {
    throw new Error(`illegal provisioning run transition: ${from} -> ${to} (terminal status)`);
  }
  const allowed = PROVISIONING_RUN_TRANSITIONS.get(from);
  if (!allowed || !allowed.includes(to)) {
    throw new Error(`illegal provisioning run transition: ${from} -> ${to}`);
  }
}

export function canTransitionProvisioningRun(from: string, to: string): boolean {
  try {
    assertProvisioningRunTransition(from, to);
    return true;
  } catch {
    return false;
  }
}
