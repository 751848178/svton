import {
  ServerAgentLifecyclePreflightSeverity,
  ServerAgentLifecyclePreflightState,
} from "./server-executor-supervisor.types";

export type AgentLifecyclePreflightInput = {
  targetSelectionEnabled: boolean;
  capableServers: number;
  onlineCapableServers: number;
  heartbeatEnabled: boolean;
  heartbeatTokenConfigured: boolean;
  heartbeatRequiredForTargetSelection: boolean;
  heartbeatServers: number;
  runtimeReadyServers: number;
  runtimeDegradedServers: number;
  runtimeStaleServers: number;
  runtimeUnknownServers: number;
  missingHeartbeatServers: number;
  executorEnabled: boolean;
  dispatcherConfigured: boolean;
  dispatcherTokenConfigured: boolean;
  liveDispatchReadyServers: number;
  pressureServers: number;
  scannedJobs: number;
  queueWorkerEnabled: boolean;
  agentReadyJobs: number;
  agentScheduledJobs: number;
  agentRunningJobs: number;
  agentStaleRunningJobs: number;
  agentBlockedJobs: number;
};

export type LifecycleBlockerEntry = {
  reason: string;
  severity: ServerAgentLifecyclePreflightSeverity;
  count: number;
};

export type LifecycleBlockerCollector = {
  blockers: LifecycleBlockerEntry[];
  nextSteps: { action: string; reason: string }[];
};

export function resolveLifecycleState(
  input: AgentLifecyclePreflightInput,
  agentPressureJobs: number,
  blockers: LifecycleBlockerEntry[],
): { state: ServerAgentLifecyclePreflightState; reason: string } {
  const lifecycleConfigured =
    input.targetSelectionEnabled ||
    input.executorEnabled ||
    input.dispatcherConfigured ||
    input.heartbeatEnabled ||
    input.capableServers > 0 ||
    agentPressureJobs > 0;
  const criticalBlocker = blockers.find((b) => b.severity === "critical");
  const warningBlocker = blockers.find((b) => b.severity === "warning");
  let state: ServerAgentLifecyclePreflightState = "ready";
  if (!lifecycleConfigured) state = "disabled";
  else if (criticalBlocker) state = "blocked";
  else if (warningBlocker) state = "degraded";
  const reason =
    state === "disabled"
      ? "agent_runtime_disabled"
      : criticalBlocker?.reason || warningBlocker?.reason || "preflight_ready";
  return { state, reason };
}

export function buildLifecycleResult(
  input: AgentLifecyclePreflightInput,
  runtimeIssueServers: number,
  agentQueuedJobs: number,
  agentPressureJobs: number,
  state: ServerAgentLifecyclePreflightState,
  reason: string,
  collector: LifecycleBlockerCollector,
) {
  return {
    state,
    reason,
    gates: {
      targetSelection: buildTargetSelectionGate(input),
      heartbeat: buildHeartbeatGate(input, runtimeIssueServers),
      dispatcher: buildDispatcherGate(input),
      queueWorker: buildQueueWorkerGate(input, agentPressureJobs),
    },
    pressure: {
      servers: input.pressureServers,
      scannedJobs: input.scannedJobs,
      queuedJobs: agentQueuedJobs,
      runningJobs: input.agentRunningJobs,
      blockedJobs: input.agentBlockedJobs,
    },
    blockers: collector.blockers,
    nextSteps: collector.nextSteps.slice(0, 8),
  };
}

function buildTargetSelectionGate(input: AgentLifecyclePreflightInput) {
  return {
    ready: input.targetSelectionEnabled && input.capableServers > 0,
    enabled: input.targetSelectionEnabled,
    capableServers: input.capableServers,
    onlineCapableServers: input.onlineCapableServers,
    reason: input.targetSelectionEnabled
      ? input.capableServers > 0
        ? "agent_targets_available"
        : "no_agent_capable_servers"
      : "agent_target_selection_disabled",
  };
}

function buildHeartbeatGate(
  input: AgentLifecyclePreflightInput,
  runtimeIssueServers: number,
) {
  return {
    ready:
      input.heartbeatEnabled &&
      input.heartbeatTokenConfigured &&
      input.runtimeReadyServers > 0 &&
      input.missingHeartbeatServers === 0 &&
      runtimeIssueServers === 0,
    enabled: input.heartbeatEnabled,
    tokenConfigured: input.heartbeatTokenConfigured,
    requiredForTargetSelection: input.heartbeatRequiredForTargetSelection,
    heartbeatServers: input.heartbeatServers,
    readyServers: input.runtimeReadyServers,
    issueServers: runtimeIssueServers,
    missingHeartbeatServers: input.missingHeartbeatServers,
    reason: !input.heartbeatEnabled
      ? "heartbeat_disabled"
      : !input.heartbeatTokenConfigured
        ? "heartbeat_token_missing"
        : input.runtimeReadyServers === 0
          ? "no_runtime_heartbeat_online"
          : input.missingHeartbeatServers > 0
            ? "missing_runtime_heartbeat"
            : runtimeIssueServers > 0
              ? "runtime_health_issue"
              : "heartbeat_runtime_ready",
  };
}

function buildDispatcherGate(input: AgentLifecyclePreflightInput) {
  return {
    ready:
      input.executorEnabled &&
      input.dispatcherConfigured &&
      input.liveDispatchReadyServers > 0,
    executorEnabled: input.executorEnabled,
    dispatcherConfigured: input.dispatcherConfigured,
    tokenConfigured: input.dispatcherTokenConfigured,
    liveDispatchReadyServers: input.liveDispatchReadyServers,
    reason: !input.executorEnabled
      ? "agent_executor_disabled"
      : !input.dispatcherConfigured
        ? "dispatcher_not_configured"
        : input.liveDispatchReadyServers > 0
          ? "dispatcher_ready"
          : "no_live_dispatch_ready_servers",
  };
}

function buildQueueWorkerGate(
  input: AgentLifecyclePreflightInput,
  agentPressureJobs: number,
) {
  return {
    ready: input.queueWorkerEnabled || agentPressureJobs === 0,
    enabled: input.queueWorkerEnabled,
    queuedJobs: input.agentReadyJobs + input.agentScheduledJobs,
    runningJobs: input.agentRunningJobs,
    staleRunningJobs: input.agentStaleRunningJobs,
    blockedJobs: input.agentBlockedJobs,
    reason: input.queueWorkerEnabled
      ? "queue_worker_enabled"
      : agentPressureJobs > 0
        ? "queue_worker_disabled_with_agent_jobs"
        : "queue_worker_idle",
  };
}
