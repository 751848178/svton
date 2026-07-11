import { buildServerAgentTaskPullLifecycleDiscovery } from "./server-agent-task-pull-lifecycle-discovery.utils";
import { ServerAgentTaskPullReadinessState } from "./server-executor-supervisor.types";
import { AgentTaskPullReadinessInput } from "./server-executor-supervisor-agent-task-pull-input.types";

export type TaskPullBlockerEntry = {
  reason: string;
  severity: "critical" | "warning";
  count: number;
};
export type TaskPullNextStepEntry = { action: string; reason: string };

export function buildTaskPullGatesAndResult(args: {
  input: AgentTaskPullReadinessInput;
  blockers: TaskPullBlockerEntry[];
  nextSteps: TaskPullNextStepEntry[];
  agentQueuedJobs: number;
  agentPressureJobs: number;
  runtimeGateReady: boolean;
  riskyAuditEvents: number;
}) {
  const {
    input,
    agentQueuedJobs,
    agentPressureJobs,
    runtimeGateReady,
    riskyAuditEvents,
  } = args;
  const readinessConfigured =
    input.targetSelectionEnabled ||
    input.heartbeatEnabled ||
    input.capableServers > 0 ||
    agentPressureJobs > 0;
  const criticalBlocker = args.blockers.find((b) => b.severity === "critical");
  const warningBlocker = args.blockers.find((b) => b.severity === "warning");
  let state: ServerAgentTaskPullReadinessState = "ready";
  if (!readinessConfigured || agentPressureJobs === 0) state = "idle";
  else if (criticalBlocker) state = "blocked";
  else if (warningBlocker) state = "degraded";
  const reason = !readinessConfigured
    ? "task_pull_readiness_disabled"
    : agentPressureJobs === 0
      ? "no_agent_task_pull_demand"
      : criticalBlocker?.reason ||
        warningBlocker?.reason ||
        "task_pull_readiness_ready";

  if (args.nextSteps.length === 0) {
    args.nextSteps.push({
      action:
        state === "idle"
          ? "wait_for_agent_task_pull_demand"
          : "ready_for_agent_task_pull_design",
      reason,
    });
  }

  return {
    state,
    reason,
    gates: {
      runtime: buildRuntimeGate(input, runtimeGateReady),
      queue: buildQueueGate(input, agentQueuedJobs),
      pullContract: buildPullContractGate(input),
      audit: buildAuditGate(input, agentPressureJobs, riskyAuditEvents),
    },
    pressure: {
      readyJobs: input.agentReadyJobs,
      scheduledJobs: input.agentScheduledJobs,
      runningJobs: input.agentRunningJobs,
      staleRunningJobs: input.agentStaleRunningJobs,
      blockedJobs: input.agentBlockedJobs,
      failedJobs: input.agentFailedJobs,
      cancelledJobs: input.agentCancelledJobs,
      pressureJobs: agentPressureJobs,
    },
    samples: {
      nextQueuedJob: input.nextQueuedJob,
      blockedReasons: input.blockedReasonSummary.reasonCounts.slice(0, 3),
      blockedReasonSamples: input.blockedReasonSummary.samples.slice(0, 3),
    },
    blockers: args.blockers,
    nextSteps: args.nextSteps.slice(0, 8),
  };
}

function buildRuntimeGate(
  input: AgentTaskPullReadinessInput,
  runtimeGateReady: boolean,
) {
  return {
    ready: runtimeGateReady,
    targetSelectionEnabled: input.targetSelectionEnabled,
    capableServers: input.capableServers,
    onlineCapableServers: input.onlineCapableServers,
    heartbeatEnabled: input.heartbeatEnabled,
    heartbeatTokenConfigured: input.heartbeatTokenConfigured,
    heartbeatRequiredForTargetSelection:
      input.heartbeatRequiredForTargetSelection,
    heartbeatServers: input.heartbeatServers,
    readyServers: input.runtimeReadyServers,
    issueServers: input.runtimeIssueServers,
    missingHeartbeatServers: input.missingHeartbeatServers,
    reason: !input.targetSelectionEnabled
      ? "agent_target_selection_disabled"
      : input.capableServers === 0
        ? "no_agent_capable_servers"
        : !input.heartbeatEnabled
          ? "heartbeat_disabled"
          : !input.heartbeatTokenConfigured
            ? "heartbeat_token_missing"
            : input.runtimeReadyServers === 0
              ? "no_runtime_heartbeat_online"
              : input.missingHeartbeatServers > 0
                ? "missing_runtime_heartbeat"
                : input.runtimeIssueServers > 0
                  ? "runtime_health_issue"
                  : "task_pull_runtime_ready",
  };
}

function buildQueueGate(
  input: AgentTaskPullReadinessInput,
  agentQueuedJobs: number,
) {
  return {
    ready: input.queueWorkerEnabled || agentQueuedJobs === 0,
    queueWorkerEnabled: input.queueWorkerEnabled,
    readyJobs: input.agentReadyJobs,
    scheduledJobs: input.agentScheduledJobs,
    runningJobs: input.agentRunningJobs,
    staleRunningJobs: input.agentStaleRunningJobs,
    blockedJobs: input.agentBlockedJobs,
    failedJobs: input.agentFailedJobs,
    cancelledJobs: input.agentCancelledJobs,
    reason: input.queueWorkerEnabled
      ? agentQueuedJobs > 0
        ? "agent_queue_backlog_ready"
        : "agent_queue_idle"
      : agentQueuedJobs > 0
        ? "queue_worker_disabled_with_agent_jobs"
        : "queue_worker_idle",
  };
}

function buildPullContractGate(input: AgentTaskPullReadinessInput) {
  return {
    ready: input.taskPullEnabled,
    endpointImplemented: true,
    contractEndpointEnabled: input.taskPullContractEnabled,
    pullEndpointImplemented: true,
    ackEndpointImplemented: true,
    finishEndpointImplemented: true,
    taskPullEnabled: input.taskPullEnabled,
    claimSupported: input.taskPullEnabled,
    ackSupported: input.taskPullEnabled,
    ackCancellationHintSupported: input.taskPullEnabled,
    ackProgressWritebackSupported: input.taskPullEnabled,
    terminalWritebackSupported: input.taskPullEnabled,
    ...buildServerAgentTaskPullLifecycleDiscovery(input.taskPullEnabled),
    lifecycleExecutionSupported: false,
    reason: !input.taskPullContractEnabled
      ? "task_pull_contract_disabled"
      : input.taskPullEnabled
        ? "task_pull_claim_ack_finish_supported"
        : "task_pull_disabled",
  };
}

function buildAuditGate(
  input: AgentTaskPullReadinessInput,
  agentPressureJobs: number,
  riskyAuditEvents: number,
) {
  return {
    ready: input.auditTotalRecent > 0 || agentPressureJobs === 0,
    totalRecent: input.auditTotalRecent,
    failedRecent: input.auditFailedRecent,
    blockedRecent: input.auditBlockedRecent,
    highRiskRecent: input.auditHighRiskRecent,
    reason:
      input.auditTotalRecent > 0
        ? riskyAuditEvents > 0
          ? "execution_audit_risk_present"
          : "execution_audit_visible"
        : agentPressureJobs > 0
          ? "execution_audit_not_seen"
          : "execution_audit_idle",
  };
}
