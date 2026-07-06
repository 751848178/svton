import type { ServerAgentTaskPullContractBuilderInput } from "./server-agent-task-pull-contract.utils";

export function buildServerAgentTaskPullGates(
  input: ServerAgentTaskPullContractBuilderInput,
  state: {
    activeDemandJobs: number;
    pressureJobs: number;
    runtimeReady: boolean;
  },
) {
  return {
    runtime: {
      ready: Boolean(input.agentRef) && state.runtimeReady,
      capabilityReady: Boolean(input.agentRef),
      heartbeatRequiredForTargetSelection: input.heartbeatRequired,
      heartbeatState: input.runtime?.state || "missing",
      reason: !input.agentRef
        ? "no_agent_capability"
        : state.runtimeReady
          ? "agent_runtime_ready"
          : input.runtime
            ? `heartbeat_${input.runtime.state}`
            : "missing_heartbeat",
    },
    queue: {
      ready: true,
      readyJobs: input.readyJobs,
      scheduledJobs: input.scheduledJobs,
      runningJobs: input.runningJobs,
      staleRunningJobs: input.staleRunningJobs,
      blockedJobs: input.blockedJobs,
      failedJobs: input.failedJobs,
      cancelledJobs: input.cancelledJobs,
      pressureJobs: state.pressureJobs,
      reason:
        state.activeDemandJobs > 0
          ? "agent_queue_demand_visible"
          : "agent_queue_idle",
    },
    contract: {
      ready: false,
      contractEndpointImplemented: true,
      contractEndpointEnabled: true,
      pullEndpointImplemented: false,
      taskPullEnabled: input.taskPullEnabled,
      claimSupported: false,
      ackSupported: false,
      lifecycleExecutionSupported: false,
      reason: input.taskPullEnabled
        ? "task_pull_claim_not_implemented"
        : "task_pull_disabled",
    },
  };
}

export function buildServerAgentTaskPullSample(
  input: ServerAgentTaskPullContractBuilderInput,
) {
  const job = input.nextQueuedJob;
  if (!job) return null;

  return {
    id: job.id,
    operationKey: job.operationKey,
    adapterKey: job.adapterKey,
    serverId: job.serverId,
    priority: job.priority,
    queuedAt: job.queuedAt.toISOString(),
    availableAt: job.availableAt.toISOString(),
    server: job.server,
  };
}
