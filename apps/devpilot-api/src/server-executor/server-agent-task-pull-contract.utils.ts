import {
  buildServerAgentTaskPullGates,
  buildServerAgentTaskPullSample,
} from "./server-agent-task-pull-gates.utils";
import { buildServerAgentTaskPullLifecycleDiscovery } from "./server-agent-task-pull-lifecycle-discovery.utils";
import { buildServerAgentTaskPullReadiness } from "./server-agent-task-pull-readiness.utils";

type TaskPullServerSnapshot = {
  id: string;
  name: string;
  host: string;
  status: string;
};

type TaskPullRuntimeSnapshot = { state: string; [key: string]: unknown };

type TaskPullNextQueuedJobSnapshot = {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId: string | null;
  priority: number;
  queuedAt: Date;
  availableAt: Date;
  inputSnapshot?: unknown;
  server: TaskPullServerSnapshot | null;
} | null;

export type ServerAgentTaskPullContractBuilderInput = {
  now: Date;
  server: TaskPullServerSnapshot;
  agentId: string;
  runnerId?: string;
  requestedCapabilities: string[];
  agentRef: unknown;
  runtime: TaskPullRuntimeSnapshot | null;
  heartbeatRequired: boolean;
  taskPullEnabled: boolean;
  pollIntervalSeconds: number;
  readyJobs: number;
  scheduledJobs: number;
  runningJobs: number;
  staleRunningJobs: number;
  blockedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  nextQueuedJob: TaskPullNextQueuedJobSnapshot;
};

export function buildServerAgentTaskPullContract(
  input: ServerAgentTaskPullContractBuilderInput,
) {
  const runtimeReady =
    !input.heartbeatRequired || input.runtime?.state === "online";
  const activeDemandJobs =
    input.readyJobs + input.scheduledJobs + input.runningJobs;
  const pressureJobs =
    activeDemandJobs +
    input.staleRunningJobs +
    input.blockedJobs +
    input.failedJobs;
  const readiness = buildServerAgentTaskPullReadiness(input, {
    activeDemandJobs,
    pressureJobs,
    runtimeReady,
  });

  return {
    accepted: true,
    generatedAt: input.now.toISOString(),
    server: input.server,
    agent: {
      agentId: input.agentId,
      ...(input.runnerId ? { runnerId: input.runnerId } : {}),
      ...(input.requestedCapabilities.length
        ? { requestedCapabilities: input.requestedCapabilities }
        : {}),
      ...(input.agentRef ? { agentRef: input.agentRef } : {}),
      runtime: input.runtime || null,
    },
    contract: buildTaskPullContract(input),
    readiness: {
      state: readiness.state,
      reason: readiness.reason,
      gates: buildServerAgentTaskPullGates(input, {
        activeDemandJobs,
        pressureJobs,
        runtimeReady,
      }),
      samples: { nextQueuedJob: buildServerAgentTaskPullSample(input) },
      blockers: readiness.blockers,
      nextSteps: readiness.nextSteps,
    },
  };
}

function buildTaskPullContract(input: ServerAgentTaskPullContractBuilderInput) {
  const lifecycleDiscovery = buildServerAgentTaskPullLifecycleDiscovery(
    input.taskPullEnabled,
  );

  return {
    version: "server-agent-task-pull.v0",
    mode: input.taskPullEnabled ? "claim_ack_finish" : "readiness_only",
    endpoint: "/server-agent/task-pull/contract",
    contractEndpointEnabled: true,
    pullEndpointImplemented: true,
    claimEndpoint: "/server-agent/task-pull/claim",
    ackEndpoint: "/server-agent/task-pull/ack",
    finishEndpoint: "/server-agent/task-pull/finish",
    taskPullEnabled: input.taskPullEnabled,
    claimSupported: input.taskPullEnabled,
    claimedTaskPayloadSupported: input.taskPullEnabled,
    ackSupported: input.taskPullEnabled,
    ackCancellationHintSupported: input.taskPullEnabled,
    ackProgressWritebackSupported: input.taskPullEnabled,
    terminalWritebackSupported: input.taskPullEnabled,
    ...lifecycleDiscovery,
    lifecycleExecutionSupported: false,
    longConnectionSupported: false,
    poll: {
      minIntervalSeconds: 30,
      recommendedIntervalSeconds: input.pollIntervalSeconds,
    },
    boundaries: [
      "readiness_only",
      "claim_only",
      "ack_only",
      "ack_cancellation_hint_only",
      "ack_progress_writeback_only",
      "terminal_writeback_only",
      "no_lifecycle_execution",
      "no_long_connection",
    ],
  };
}
