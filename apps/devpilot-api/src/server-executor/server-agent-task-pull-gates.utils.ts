import type { ServerAgentTaskPullContractBuilderInput } from "./server-agent-task-pull-contract.utils";
import { buildServerAgentTaskPullLifecycleDiscovery } from "./server-agent-task-pull-lifecycle-discovery.utils";
import { isRecord, readOptionalString } from "./server-executor-json.utils";

type ServerAgentLogFollowJobSnapshot = {
  operationKey: string;
  inputSnapshot?: unknown;
};

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
      ready: input.taskPullEnabled,
      contractEndpointImplemented: true,
      contractEndpointEnabled: true,
      pullEndpointImplemented: true,
      ackEndpointImplemented: true,
      finishEndpointImplemented: true,
      taskPullEnabled: input.taskPullEnabled,
      claimSupported: input.taskPullEnabled,
      claimedTaskPayloadSupported: input.taskPullEnabled,
      ackSupported: input.taskPullEnabled,
      ackCancellationHintSupported: input.taskPullEnabled,
      ackProgressWritebackSupported: input.taskPullEnabled,
      terminalWritebackSupported: input.taskPullEnabled,
      ...buildServerAgentTaskPullLifecycleDiscovery(input.taskPullEnabled),
      lifecycleExecutionSupported: false,
      reason: input.taskPullEnabled
        ? "task_pull_claim_ack_finish_supported"
        : "task_pull_disabled",
    },
  };
}

export function buildServerAgentTaskPullSample(
  input: ServerAgentTaskPullContractBuilderInput,
) {
  return input.nextQueuedJob
    ? buildServerAgentTaskPullJobSample(input.nextQueuedJob)
    : null;
}

export function buildServerAgentTaskPullJobSample(
  job: NonNullable<ServerAgentTaskPullContractBuilderInput["nextQueuedJob"]>,
) {
  return {
    id: job.id,
    operationKey: job.operationKey,
    adapterKey: job.adapterKey,
    serverId: job.serverId,
    priority: job.priority,
    queuedAt: job.queuedAt.toISOString(),
    availableAt: job.availableAt.toISOString(),
    server: job.server,
    logFollow: buildServerAgentLogFollowHint(job),
  };
}

export function buildServerAgentLogFollowHint(
  job: ServerAgentLogFollowJobSnapshot,
) {
  if (!job.operationKey.startsWith("log.collect.")) return null;

  const snapshot = isRecord(job.inputSnapshot) ? job.inputSnapshot : {};
  const metadata = isRecord(snapshot.metadata) ? snapshot.metadata : {};
  const params = isRecord(metadata.params) ? metadata.params : {};
  const followMode = readOptionalString(params.followMode);
  const requiredTransport = readOptionalString(params.requiredTransport);

  if (followMode !== "agent" && requiredTransport !== "server_agent") {
    return null;
  }

  return {
    kind: "log_follow",
    mode: followMode || "agent",
    streamId: readOptionalString(metadata.logStreamId) || null,
    collectionRunId: readOptionalString(metadata.logCollectionRunId) || null,
    sourceType:
      readOptionalString(metadata.sourceType) ||
      readOptionalString(params.sourceType) ||
      null,
    sourceKey: readOptionalString(metadata.sourceKey) || null,
    requiredTransport:
      requiredTransport === "server_agent" ? "server_agent" : null,
    confirmLiveRead:
      typeof params.confirmLiveRead === "boolean"
        ? params.confirmLiveRead
        : null,
  };
}
