import { Injectable } from "@nestjs/common";
import { QueueCoordinationPreflightSeverity } from "./server-executor-supervisor.types";
import {
  buildQueueCoordinationResult,
  QueueCoordinationCollector,
  QueueCoordinationPreflightInput,
  resolveQueueCoordinationState,
} from "./server-executor-supervisor-queue-coordination-builder.utils";

@Injectable()
export class ServerExecutorSupervisorQueueCoordinationSummaryService {
  summarize(input: QueueCoordinationPreflightInput) {
    const backlogJobs = input.readyQueuedJobs + input.scheduledQueuedJobs;
    const pressureJobs = backlogJobs + input.runningJobs + input.blockedJobs;
    const collector: QueueCoordinationCollector = {
      blockers: [],
      nextSteps: [],
    };
    const nextStepKeys = new Set<string>();
    const { addBlocker, addNextStep } = this.bindCollectors(
      collector,
      nextStepKeys,
    );

    if (!input.queueWorkerEnabled && backlogJobs > 0) {
      addBlocker("queue_worker_disabled_with_backlog", "critical", backlogJobs);
      addNextStep("enable_queue_worker", "queue_worker_disabled_with_backlog");
    }
    if (
      input.queueWorkerEnabled &&
      backlogJobs > 0 &&
      input.activeOwners === 0
    ) {
      addBlocker("no_active_worker_owner", "warning", backlogJobs);
      addNextStep("inspect_worker_startup", "no_active_worker_owner");
    }
    if (input.expiredOwners > 0) {
      addBlocker("expired_worker_owner", "warning", input.expiredOwners);
      addNextStep("recover_expired_worker_owner", "expired_worker_owner");
    }
    if (input.staleOwners > 0) {
      addBlocker("stale_worker_owner", "warning", input.staleOwners);
      addNextStep("inspect_worker_owners", "stale_worker_owner");
    }
    if (input.unownedRunningJobs > 0) {
      addBlocker("unowned_running_jobs", "warning", input.unownedRunningJobs);
      addNextStep("inspect_unowned_running_jobs", "unowned_running_jobs");
    }
    if (input.staleRunningJobs > 0) {
      addBlocker("stale_running_jobs", "warning", input.staleRunningJobs);
      addNextStep("recover_stale_jobs", "stale_running_jobs");
    }
    if (input.staleRunningJobs > 0 && !input.staleRemoteCleanupEnabled) {
      addBlocker(
        "stale_remote_cleanup_disabled_with_stale_jobs",
        "warning",
        input.staleRunningJobs,
      );
      addNextStep(
        "enable_stale_remote_cleanup",
        "stale_remote_cleanup_disabled_with_stale_jobs",
      );
    }
    if (input.blockedJobs > 0) {
      addBlocker("blocked_jobs", "warning", input.blockedJobs);
      addNextStep("inspect_blocked_jobs", "blocked_jobs");
    }

    const { state, reason } = resolveQueueCoordinationState(
      input,
      backlogJobs,
      pressureJobs,
      collector,
    );
    if (collector.nextSteps.length === 0) {
      collector.nextSteps.push({
        action:
          state === "idle"
            ? "monitor_queue_pressure"
            : "ready_for_multi_instance_queue_coordination",
        reason,
      });
    }

    return buildQueueCoordinationResult(
      input,
      backlogJobs,
      state,
      reason,
      collector,
    );
  }

  private bindCollectors(
    collector: QueueCoordinationCollector,
    nextStepKeys: Set<string>,
  ) {
    const addBlocker = (
      reason: string,
      severity: QueueCoordinationPreflightSeverity,
      count = 1,
    ) => {
      if (count > 0) collector.blockers.push({ reason, severity, count });
    };
    const addNextStep = (action: string, reason: string) => {
      const key = `${action}:${reason}`;
      if (nextStepKeys.has(key)) return;
      nextStepKeys.add(key);
      collector.nextSteps.push({ action, reason });
    };
    return { addBlocker, addNextStep };
  }
}
