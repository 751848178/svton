import { Injectable } from "@nestjs/common";
import {
  AgentLifecyclePreflightInput,
  buildLifecycleResult,
  LifecycleBlockerCollector,
  resolveLifecycleState,
} from "./server-executor-supervisor-agent-lifecycle-builder.utils";

@Injectable()
export class ServerExecutorSupervisorAgentLifecycleSummaryService {
  summarize(input: AgentLifecyclePreflightInput) {
    const runtimeIssueServers =
      input.runtimeDegradedServers +
      input.runtimeStaleServers +
      input.runtimeUnknownServers;
    const agentQueuedJobs = input.agentReadyJobs + input.agentScheduledJobs;
    const agentPressureJobs =
      agentQueuedJobs + input.agentRunningJobs + input.agentBlockedJobs;
    const collector: LifecycleBlockerCollector = {
      blockers: [],
      nextSteps: [],
    };
    const { addBlocker, addNextStep } = this.bindCollectors(collector);

    if (!input.targetSelectionEnabled) {
      addBlocker("agent_target_selection_disabled", "critical");
      addNextStep(
        "enable_agent_target_selection",
        "agent_target_selection_disabled",
      );
    }
    if (input.capableServers === 0) {
      addBlocker("no_agent_capable_servers", "critical");
      addNextStep("register_agent_capable_servers", "no_agent_capable_servers");
    }
    if (!input.heartbeatEnabled) {
      addBlocker("heartbeat_disabled", "critical");
      addNextStep("enable_agent_heartbeat", "heartbeat_disabled");
    } else if (!input.heartbeatTokenConfigured) {
      addBlocker("heartbeat_token_missing", "critical");
      addNextStep("configure_agent_heartbeat_token", "heartbeat_token_missing");
    } else {
      this.collectHeartbeatBlockers(input, addBlocker, addNextStep);
    }
    if (!input.executorEnabled) {
      addBlocker("agent_executor_disabled", "critical");
      addNextStep("enable_agent_executor", "agent_executor_disabled");
    }
    if (!input.dispatcherConfigured) {
      addBlocker("dispatcher_not_configured", "critical");
      addNextStep("configure_agent_dispatcher", "dispatcher_not_configured");
    } else if (
      input.capableServers > 0 &&
      input.liveDispatchReadyServers === 0
    ) {
      addBlocker("no_live_dispatch_ready_servers", "warning");
      addNextStep(
        "align_live_dispatch_ready_servers",
        "no_live_dispatch_ready_servers",
      );
    }
    if (!input.queueWorkerEnabled && agentQueuedJobs > 0) {
      addBlocker(
        "queue_worker_disabled_with_agent_jobs",
        "critical",
        agentQueuedJobs,
      );
      addNextStep(
        "enable_queue_worker",
        "queue_worker_disabled_with_agent_jobs",
      );
    }
    if (input.agentStaleRunningJobs > 0) {
      addBlocker(
        "stale_agent_running_jobs",
        "warning",
        input.agentStaleRunningJobs,
      );
      addNextStep("recover_stale_agent_jobs", "stale_agent_running_jobs");
    }
    if (input.agentBlockedJobs > 0) {
      addBlocker("blocked_agent_jobs", "warning", input.agentBlockedJobs);
      addNextStep("inspect_blocked_agent_jobs", "blocked_agent_jobs");
    }

    const { state, reason } = resolveLifecycleState(
      input,
      agentPressureJobs,
      collector.blockers,
    );
    if (collector.nextSteps.length === 0) {
      collector.nextSteps.push({
        action: "ready_for_agent_runtime_lifecycle",
        reason: "preflight_ready",
      });
    }

    return buildLifecycleResult(
      input,
      runtimeIssueServers,
      agentQueuedJobs,
      agentPressureJobs,
      state,
      reason,
      collector,
    );
  }

  private bindCollectors(collector: LifecycleBlockerCollector) {
    const addBlocker = (
      reason: string,
      severity: "critical" | "warning",
      count = 1,
    ) => {
      if (count > 0) collector.blockers.push({ reason, severity, count });
    };
    const addNextStep = (action: string, reason: string) => {
      collector.nextSteps.push({ action, reason });
    };
    return { addBlocker, addNextStep };
  }

  private collectHeartbeatBlockers(
    input: AgentLifecyclePreflightInput,
    addBlocker: (
      reason: string,
      severity: "critical" | "warning",
      count?: number,
    ) => void,
    addNextStep: (action: string, reason: string) => void,
  ) {
    const runtimeIssueServers =
      input.runtimeDegradedServers +
      input.runtimeStaleServers +
      input.runtimeUnknownServers;
    if (input.capableServers > 0 && input.runtimeReadyServers === 0) {
      addBlocker("no_runtime_heartbeat_online", "critical");
      addNextStep(
        "start_agent_heartbeat_runtime",
        "no_runtime_heartbeat_online",
      );
    }
    if (input.missingHeartbeatServers > 0) {
      addBlocker(
        "missing_runtime_heartbeat",
        "warning",
        input.missingHeartbeatServers,
      );
      addNextStep(
        "roll_out_missing_agent_heartbeats",
        "missing_runtime_heartbeat",
      );
    }
    if (runtimeIssueServers > 0) {
      addBlocker("runtime_health_issue", "warning", runtimeIssueServers);
      addNextStep("inspect_agent_runtime_health", "runtime_health_issue");
    }
  }
}
