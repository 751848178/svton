import { Injectable } from "@nestjs/common";
import { ServerAgentTaskPullReadinessSeverity } from "./server-executor-supervisor.types";
import { buildTaskPullGatesAndResult } from "./server-executor-supervisor-agent-task-pull-builder.utils";
import { AgentTaskPullReadinessInput } from "./server-executor-supervisor-agent-task-pull-input.types";

@Injectable()
export class ServerExecutorSupervisorAgentTaskPullSummaryService {
  summarize(input: AgentTaskPullReadinessInput) {
    const agentQueuedJobs = input.agentReadyJobs + input.agentScheduledJobs;
    const agentPressureJobs =
      agentQueuedJobs +
      input.agentRunningJobs +
      input.agentBlockedJobs +
      input.agentFailedJobs;
    const runtimeGateReady =
      input.targetSelectionEnabled &&
      input.capableServers > 0 &&
      input.heartbeatEnabled &&
      input.heartbeatTokenConfigured &&
      input.runtimeReadyServers > 0 &&
      input.missingHeartbeatServers === 0 &&
      input.runtimeIssueServers === 0;
    const hasTaskPullDemand = agentQueuedJobs + input.agentRunningJobs > 0;
    const blockers: {
      reason: string;
      severity: ServerAgentTaskPullReadinessSeverity;
      count: number;
    }[] = [];
    const nextSteps: { action: string; reason: string }[] = [];

    const addBlocker = (
      reason: string,
      severity: ServerAgentTaskPullReadinessSeverity,
      count = 1,
    ) => {
      if (count > 0) blockers.push({ reason, severity, count });
    };
    const addNextStep = (action: string, reason: string) => {
      nextSteps.push({ action, reason });
    };

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
      if (input.runtimeIssueServers > 0) {
        addBlocker(
          "runtime_health_issue",
          "warning",
          input.runtimeIssueServers,
        );
        addNextStep("inspect_agent_runtime_health", "runtime_health_issue");
      }
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
    if (input.agentReadyJobs > 0 && !input.nextQueuedJob) {
      addBlocker(
        "missing_next_agent_job_sample",
        "critical",
        input.agentReadyJobs,
      );
      addNextStep(
        "inspect_agent_job_queue_ordering",
        "missing_next_agent_job_sample",
      );
    }
    if (!input.taskPullContractEnabled && hasTaskPullDemand) {
      addBlocker(
        "task_pull_contract_disabled",
        "critical",
        agentQueuedJobs + input.agentRunningJobs,
      );
      addNextStep(
        "enable_agent_task_pull_contract",
        "task_pull_contract_disabled",
      );
    } else if (hasTaskPullDemand) {
      const reason = input.taskPullEnabled
        ? "task_pull_claim_not_implemented"
        : "task_pull_disabled";
      addBlocker(reason, "critical", agentQueuedJobs + input.agentRunningJobs);
      addNextStep(
        input.taskPullEnabled
          ? "implement_agent_task_claim"
          : "enable_agent_task_pull_after_claim_design",
        reason,
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
    if (input.agentFailedJobs > 0) {
      addBlocker("failed_agent_jobs", "warning", input.agentFailedJobs);
      addNextStep("inspect_failed_agent_jobs", "failed_agent_jobs");
    }
    const riskyAuditEvents =
      input.auditFailedRecent +
      input.auditBlockedRecent +
      input.auditHighRiskRecent;
    if (riskyAuditEvents > 0) {
      addBlocker("execution_audit_risk_present", "warning", riskyAuditEvents);
      addNextStep(
        "inspect_execution_audit_events",
        "execution_audit_risk_present",
      );
    }

    return buildTaskPullGatesAndResult({
      input,
      blockers,
      nextSteps,
      agentQueuedJobs,
      agentPressureJobs,
      runtimeGateReady,
      riskyAuditEvents,
    });
  }
}
