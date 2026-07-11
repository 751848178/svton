import type { AgentTaskPullAckResponse } from "./agent-task-pull-types";

export function readAgentTaskPullAckRejectionReason(
  ack: AgentTaskPullAckResponse,
) {
  if (ack.acked !== false) return undefined;
  return ack.reason || "ack_rejected";
}
