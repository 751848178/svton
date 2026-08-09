import type { DashboardApproval } from '../types';

/** A pending approval is a personal todo only when the API grants review. */
export function countActionableApprovals(approvals: DashboardApproval[]): number {
  return approvals.filter((approval) => approval.capabilities?.review === true).length;
}
