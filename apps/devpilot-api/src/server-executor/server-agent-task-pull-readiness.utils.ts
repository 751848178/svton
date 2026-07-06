import type { ServerAgentTaskPullContractBuilderInput } from "./server-agent-task-pull-contract.utils";
import type {
  ServerAgentTaskPullReadinessSeverity,
  ServerAgentTaskPullReadinessState,
} from "./server-executor-supervisor.types";

type ReadinessBlocker = {
  reason: string;
  severity: ServerAgentTaskPullReadinessSeverity;
  count: number;
};

type ReadinessNextStep = { action: string; reason: string };

export function buildServerAgentTaskPullReadiness(
  input: ServerAgentTaskPullContractBuilderInput,
  state: {
    activeDemandJobs: number;
    pressureJobs: number;
    runtimeReady: boolean;
  },
) {
  const blockers = buildTaskPullBlockers(input, state);
  const nextSteps = buildTaskPullNextSteps(input, state);
  const criticalBlocker = blockers.find((b) => b.severity === "critical");
  const warningBlocker = blockers.find((b) => b.severity === "warning");
  const reason =
    criticalBlocker?.reason ||
    warningBlocker?.reason ||
    (state.pressureJobs > 0
      ? "task_pull_contract_readiness_visible"
      : "no_agent_task_pull_demand");

  if (nextSteps.length === 0) {
    nextSteps.push({ action: "wait_for_agent_task_pull_demand", reason });
  }

  return {
    state: resolveTaskPullReadinessState(
      state.pressureJobs,
      criticalBlocker,
      warningBlocker,
    ),
    reason,
    blockers,
    nextSteps: nextSteps.slice(0, 8),
  };
}

function buildTaskPullBlockers(
  input: ServerAgentTaskPullContractBuilderInput,
  state: { activeDemandJobs: number; runtimeReady: boolean },
) {
  const blockers: ReadinessBlocker[] = [];
  const push = (
    reason: string,
    severity: ServerAgentTaskPullReadinessSeverity,
    count = 1,
  ) => {
    if (count > 0) blockers.push({ reason, severity, count });
  };

  if (!input.agentRef) push("no_agent_capability", "critical");
  if (!state.runtimeReady) push(runtimeReason(input), "critical");
  if (state.activeDemandJobs > 0) {
    push(
      taskPullDemandReason(input.taskPullEnabled),
      "critical",
      state.activeDemandJobs,
    );
  }
  push("stale_agent_running_jobs", "warning", input.staleRunningJobs);
  push("blocked_agent_jobs", "warning", input.blockedJobs);
  push("failed_agent_jobs", "warning", input.failedJobs);
  return blockers;
}

function buildTaskPullNextSteps(
  input: ServerAgentTaskPullContractBuilderInput,
  state: { activeDemandJobs: number; runtimeReady: boolean },
) {
  const nextSteps: ReadinessNextStep[] = [];
  const push = (action: string, reason: string) => {
    nextSteps.push({ action, reason });
  };

  if (!input.agentRef) push("register_agent_capability", "no_agent_capability");
  if (!state.runtimeReady) {
    push("start_agent_heartbeat_runtime", runtimeReason(input));
  }
  if (state.activeDemandJobs > 0) {
    const reason = taskPullDemandReason(input.taskPullEnabled);
    push(
      input.taskPullEnabled
        ? "implement_agent_task_claim"
        : "enable_agent_task_pull_after_claim_design",
      reason,
    );
  }
  if (input.staleRunningJobs > 0) {
    push("recover_stale_agent_jobs", "stale_agent_running_jobs");
  }
  if (input.blockedJobs > 0) {
    push("inspect_blocked_agent_jobs", "blocked_agent_jobs");
  }
  if (input.failedJobs > 0) {
    push("inspect_failed_agent_jobs", "failed_agent_jobs");
  }
  return nextSteps;
}

function resolveTaskPullReadinessState(
  pressureJobs: number,
  criticalBlocker: ReadinessBlocker | undefined,
  warningBlocker: ReadinessBlocker | undefined,
): ServerAgentTaskPullReadinessState {
  if (criticalBlocker) return "blocked";
  if (warningBlocker) return "degraded";
  return pressureJobs > 0 ? "blocked" : "idle";
}

function runtimeReason(input: ServerAgentTaskPullContractBuilderInput) {
  return input.runtime
    ? `heartbeat_${input.runtime.state}`
    : "missing_heartbeat";
}

function taskPullDemandReason(taskPullEnabled: boolean) {
  return taskPullEnabled
    ? "task_pull_claim_not_implemented"
    : "task_pull_disabled";
}
