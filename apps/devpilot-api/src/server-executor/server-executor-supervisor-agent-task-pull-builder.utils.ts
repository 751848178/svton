import { ServerAgentTaskPullReadinessState } from "./server-executor-supervisor.types";
import {
  buildSupervisorAgentTaskPullAuditGate,
  buildSupervisorAgentTaskPullContractGate,
  buildSupervisorAgentTaskPullQueueGate,
  buildSupervisorAgentTaskPullRuntimeGate,
} from "./server-executor-supervisor-agent-task-pull-gates.utils";
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
      runtime: buildSupervisorAgentTaskPullRuntimeGate(input, runtimeGateReady),
      queue: buildSupervisorAgentTaskPullQueueGate(input, agentQueuedJobs),
      pullContract: buildSupervisorAgentTaskPullContractGate(input),
      audit: buildSupervisorAgentTaskPullAuditGate(
        input,
        agentPressureJobs,
        riskyAuditEvents,
      ),
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
