import { AgentLifecyclePreflightInput } from "./server-executor-supervisor-agent-lifecycle-builder.utils";
import { AgentTaskPullReadinessInput } from "./server-executor-supervisor-agent-task-pull-input.types";
import { SupervisorQueuedJobSample } from "./server-executor-supervisor.types";

type AgentReadinessSummary = {
  targetSelectionEnabled: boolean;
  capableServers: number;
  onlineCapableServers: number;
  runtime: {
    heartbeatEnabled: boolean;
    tokenConfigured: boolean;
    requiredForTargetSelection: boolean;
    heartbeatServers: number;
  };
};

type AgentRuntimeHealthSummary = {
  readyServers: number;
  degradedServers: number;
  staleServers: number;
  unknownServers: number;
  missingHeartbeatServers: number;
};

type AgentDispatcherSummary = {
  executorEnabled: boolean;
  dispatcherConfigured: boolean;
  tokenConfigured: boolean;
};

type AgentFleetSummary = {
  liveDispatchReadyServers: number;
  pressureServers: number;
  scannedJobs: number;
};

export function buildAgentNextQueuedJobSummary(
  agentNextQueuedJob: SupervisorQueuedJobSample | null,
) {
  return agentNextQueuedJob
    ? {
        id: agentNextQueuedJob.id,
        operationKey: agentNextQueuedJob.operationKey,
        adapterKey: agentNextQueuedJob.adapterKey,
        serverId: agentNextQueuedJob.serverId,
        priority: agentNextQueuedJob.priority,
        queuedAt: agentNextQueuedJob.queuedAt.toISOString(),
        availableAt: agentNextQueuedJob.availableAt.toISOString(),
        server: agentNextQueuedJob.server,
      }
    : null;
}

export type AgentSummaryInputs = {
  readiness: AgentReadinessSummary;
  runtimeHealth: AgentRuntimeHealthSummary;
  dispatcher: AgentDispatcherSummary;
  fleet: AgentFleetSummary;
  workerQueueWorkerEnabled: boolean;
  agentReadyJobs: number;
  agentScheduledJobs: number;
  agentRunningJobs: number;
  agentStaleRunningJobs: number;
  agentBlockedJobs: number;
  agentFailedJobs: number;
  agentCancelledJobs: number;
};

export function buildAgentLifecycleInput(
  i: AgentSummaryInputs,
): AgentLifecyclePreflightInput {
  return {
    targetSelectionEnabled: i.readiness.targetSelectionEnabled,
    capableServers: i.readiness.capableServers,
    onlineCapableServers: i.readiness.onlineCapableServers,
    heartbeatEnabled: i.readiness.runtime.heartbeatEnabled,
    heartbeatTokenConfigured: i.readiness.runtime.tokenConfigured,
    heartbeatRequiredForTargetSelection:
      i.readiness.runtime.requiredForTargetSelection,
    heartbeatServers: i.readiness.runtime.heartbeatServers,
    runtimeReadyServers: i.runtimeHealth.readyServers,
    runtimeDegradedServers: i.runtimeHealth.degradedServers,
    runtimeStaleServers: i.runtimeHealth.staleServers,
    runtimeUnknownServers: i.runtimeHealth.unknownServers,
    missingHeartbeatServers: i.runtimeHealth.missingHeartbeatServers,
    executorEnabled: i.dispatcher.executorEnabled,
    dispatcherConfigured: i.dispatcher.dispatcherConfigured,
    dispatcherTokenConfigured: i.dispatcher.tokenConfigured,
    liveDispatchReadyServers: i.fleet.liveDispatchReadyServers,
    pressureServers: i.fleet.pressureServers,
    scannedJobs: i.fleet.scannedJobs,
    queueWorkerEnabled: i.workerQueueWorkerEnabled,
    agentReadyJobs: i.agentReadyJobs,
    agentScheduledJobs: i.agentScheduledJobs,
    agentRunningJobs: i.agentRunningJobs,
    agentStaleRunningJobs: i.agentStaleRunningJobs,
    agentBlockedJobs: i.agentBlockedJobs,
  };
}

export function buildAgentTaskPullInput(
  i: AgentSummaryInputs & {
    taskPullContractEnabled: boolean;
    taskPullEnabled: boolean;
    nextQueuedJobSummary: ReturnType<typeof buildAgentNextQueuedJobSummary>;
    blockedReasonSummary: AgentTaskPullReadinessInput["blockedReasonSummary"];
    auditTotalRecent: number;
    auditFailedRecent: number;
    auditBlockedRecent: number;
    auditHighRiskRecent: number;
  },
): AgentTaskPullReadinessInput {
  return {
    targetSelectionEnabled: i.readiness.targetSelectionEnabled,
    capableServers: i.readiness.capableServers,
    onlineCapableServers: i.readiness.onlineCapableServers,
    heartbeatEnabled: i.readiness.runtime.heartbeatEnabled,
    heartbeatTokenConfigured: i.readiness.runtime.tokenConfigured,
    heartbeatRequiredForTargetSelection:
      i.readiness.runtime.requiredForTargetSelection,
    heartbeatServers: i.readiness.runtime.heartbeatServers,
    taskPullContractEnabled: i.taskPullContractEnabled,
    taskPullEnabled: i.taskPullEnabled,
    runtimeReadyServers: i.runtimeHealth.readyServers,
    runtimeIssueServers:
      i.runtimeHealth.degradedServers +
      i.runtimeHealth.staleServers +
      i.runtimeHealth.unknownServers,
    missingHeartbeatServers: i.runtimeHealth.missingHeartbeatServers,
    queueWorkerEnabled: i.workerQueueWorkerEnabled,
    agentReadyJobs: i.agentReadyJobs,
    agentScheduledJobs: i.agentScheduledJobs,
    agentRunningJobs: i.agentRunningJobs,
    agentStaleRunningJobs: i.agentStaleRunningJobs,
    agentBlockedJobs: i.agentBlockedJobs,
    agentFailedJobs: i.agentFailedJobs,
    agentCancelledJobs: i.agentCancelledJobs,
    nextQueuedJob: i.nextQueuedJobSummary,
    blockedReasonSummary: i.blockedReasonSummary,
    auditTotalRecent: i.auditTotalRecent,
    auditFailedRecent: i.auditFailedRecent,
    auditBlockedRecent: i.auditBlockedRecent,
    auditHighRiskRecent: i.auditHighRiskRecent,
  };
}
