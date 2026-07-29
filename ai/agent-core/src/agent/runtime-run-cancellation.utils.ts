import type { Agent } from '@earendil-works/pi-agent-core';
import type { ApprovalGate } from './approval-gate';

/** Abort only the run that still owns the captured Pi signal. */
export function cancelAgentRun(
  agent: Agent,
  approvalGate: ApprovalGate,
  expectedSignal: AbortSignal,
): void {
  if (agent.signal !== expectedSignal) return;
  agent.abort();
  approvalGate.abortPending();
}
