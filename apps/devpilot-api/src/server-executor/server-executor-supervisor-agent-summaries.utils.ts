import { ServerExecutorSupervisorAgentFleetSummaryService } from "./server-executor-supervisor-agent-fleet-summary.service";
import { ServerExecutorSupervisorAgentBlockedReasonsSummaryService } from "./server-executor-supervisor-agent-blocked-reasons-summary.service";
import { ServerExecutorSupervisorAgentLifecycleSummaryService } from "./server-executor-supervisor-agent-lifecycle-summary.service";
import { ServerExecutorSupervisorAgentTaskPullSummaryService } from "./server-executor-supervisor-agent-task-pull-summary.service";
import {
  buildAgentLifecycleInput,
  buildAgentNextQueuedJobSummary,
  buildAgentTaskPullInput,
} from "./server-executor-supervisor-agent-input-builder.utils";
import { SupervisorQueuedJobSample } from "./server-executor-supervisor.types";

type AuditVisibility = {
  totalRecent: number;
  failedRecent: number;
  blockedRecent: number;
  highRiskRecent: number;
};

type AgentSummaryParams = {
  servers: unknown;
  agentFleetJobs: unknown;
  now: Date;
  agentDispatcher: unknown;
  agentReadiness: unknown;
  agentRuntimeHealth: unknown;
  workerQueueWorkerEnabled: boolean;
  heartbeatDefaultTtlSeconds: number;
  heartbeatRequiredForTargetSelection: boolean;
  taskPullContractEnabled: boolean;
  taskPullEnabled: boolean;
  agentReadyQueuedJobs: number;
  agentScheduledQueuedJobs: number;
  agentRunningJobs: number;
  agentStaleRunningJobs: number;
  agentBlockedJobs: number;
  agentFailedJobs: number;
  agentCancelledJobs: number;
  agentNextQueuedJob: SupervisorQueuedJobSample | null;
  agentBlockedReasonJobs: unknown;
  executionAuditVisibility: AuditVisibility;
};

export function buildAgentSummaries(
  fleetSummary: ServerExecutorSupervisorAgentFleetSummaryService,
  blockedReasonsSummary: ServerExecutorSupervisorAgentBlockedReasonsSummaryService,
  lifecycleSummary: ServerExecutorSupervisorAgentLifecycleSummaryService,
  taskPullSummary: ServerExecutorSupervisorAgentTaskPullSummaryService,
  p: AgentSummaryParams,
) {
  const agentFleet = fleetSummary.summarizeFleet(
    p.servers as never[],
    p.agentFleetJobs as never,
    p.now,
    p.agentDispatcher as never,
    p.heartbeatDefaultTtlSeconds,
    p.heartbeatRequiredForTargetSelection,
  );
  const agentBlockedReasons = blockedReasonsSummary.summarize(
    p.agentBlockedReasonJobs as never[],
  );
  const agentSummaryInputs = {
    readiness: p.agentReadiness as never,
    runtimeHealth: p.agentRuntimeHealth as never,
    dispatcher: p.agentDispatcher as never,
    fleet: agentFleet,
    workerQueueWorkerEnabled: p.workerQueueWorkerEnabled,
    agentReadyJobs: p.agentReadyQueuedJobs,
    agentScheduledJobs: p.agentScheduledQueuedJobs,
    agentRunningJobs: p.agentRunningJobs,
    agentStaleRunningJobs: p.agentStaleRunningJobs,
    agentBlockedJobs: p.agentBlockedJobs,
    agentFailedJobs: p.agentFailedJobs,
    agentCancelledJobs: p.agentCancelledJobs,
  };
  const agentLifecyclePreflight = lifecycleSummary.summarize(
    buildAgentLifecycleInput(agentSummaryInputs),
  );
  const agentNextQueuedJobSummary = buildAgentNextQueuedJobSummary(
    p.agentNextQueuedJob,
  );
  const agentTaskPullReadiness = taskPullSummary.summarize(
    buildAgentTaskPullInput({
      ...agentSummaryInputs,
      taskPullContractEnabled: p.taskPullContractEnabled,
      taskPullEnabled: p.taskPullEnabled,
      nextQueuedJobSummary: agentNextQueuedJobSummary,
      blockedReasonSummary: agentBlockedReasons as never,
      auditTotalRecent: p.executionAuditVisibility.totalRecent,
      auditFailedRecent: p.executionAuditVisibility.failedRecent,
      auditBlockedRecent: p.executionAuditVisibility.blockedRecent,
      auditHighRiskRecent: p.executionAuditVisibility.highRiskRecent,
    }),
  );
  return {
    agentFleet,
    agentBlockedReasons,
    agentLifecyclePreflight,
    agentTaskPullReadiness,
    agentNextQueuedJobSummary,
  };
}
