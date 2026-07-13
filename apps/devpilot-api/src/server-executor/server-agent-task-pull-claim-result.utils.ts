import type { ServerAgentTaskPullClaimDto } from "./dto/server-execution-lease.dto";

export const SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT =
  "/server-agent/task-pull/claim";

export type ServerAgentClaimServerSnapshot = {
  id: string;
  name: string;
  host: string;
  status: string;
};

export function buildServerAgentTaskPullClaimBaseResponse(
  dto: ServerAgentTaskPullClaimDto,
  server: ServerAgentClaimServerSnapshot,
  now: Date,
  agentRef: unknown,
  runtime: unknown,
) {
  return {
    accepted: true,
    generatedAt: now.toISOString(),
    server: {
      id: server.id,
      name: server.name,
      host: server.host,
      status: server.status,
    },
    agent: {
      agentId: dto.agentId.trim(),
      ...(dto.runnerId?.trim() ? { runnerId: dto.runnerId.trim() } : {}),
      ...(agentRef ? { agentRef } : {}),
      runtime: runtime || null,
    },
  };
}

export function buildServerAgentTaskPullNoClaimResult(reason: string) {
  return {
    accepted: true,
    claimed: false,
    reason,
    endpoint: SERVER_AGENT_TASK_PULL_CLAIM_ENDPOINT,
    job: null,
  };
}

export function buildServerAgentTaskPullClaimMetadata(
  lockOwner: string | null,
  lockExpiresAt: Date | null,
) {
  return {
    mode: "claim_only",
    taskPullEnabled: true,
    pullEndpointImplemented: true,
    claimSupported: true,
    ackSupported: true,
    claimedTaskPayloadSupported: true,
    terminalWritebackSupported: true,
    lifecycleExecutionSupported: false,
    longConnectionSupported: false,
    lockOwner,
    lockExpiresAt: lockExpiresAt?.toISOString() || null,
    boundaries: [
      "claim_only",
      "ack_requires_follow_up",
      "finish_supported",
      "no_lifecycle_execution",
    ],
  };
}
