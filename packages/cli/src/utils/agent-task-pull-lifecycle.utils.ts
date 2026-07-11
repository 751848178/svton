import type {
  AgentTaskPullConfig,
  AgentTaskPullIdentity,
} from "./agent-task-pull-types";

export function assertAgentTaskPullLifecycleSupported(
  contract: {
    claimedTaskLifecycleEnvelopeSupported?: boolean;
    lifecycleEnvelope?: { claimResponseField?: string } | null;
  } = {},
) {
  if (
    !contract.claimedTaskLifecycleEnvelopeSupported ||
    contract.lifecycleEnvelope?.claimResponseField !== "task.lifecycle"
  ) {
    throw new Error("Task-pull lifecycle envelope is not available");
  }
}

export function toAgentTaskPullIdentity(
  config: AgentTaskPullConfig,
): AgentTaskPullIdentity {
  return {
    teamId: config.teamId,
    serverId: config.serverId,
    agentId: config.agentId,
    runnerId: config.runnerId,
    capabilities: config.capabilities,
  };
}
