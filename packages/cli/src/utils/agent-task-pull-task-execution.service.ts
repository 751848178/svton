import { readAgentTaskPullAckRejectionReason } from "./agent-task-pull-ack.utils";
import { buildAgentTaskPullDryRunResults } from "./agent-task-pull-dry-run.utils";
import { executeAgentTaskPullStep } from "./agent-task-pull-executor";
import {
  buildAgentTaskPullExecutionResult,
  percent,
} from "./agent-task-pull-result.utils";
import {
  createLinkedAbortController,
  startAgentTaskPullStepAckRenewal,
} from "./agent-task-pull-step-control";
import type {
  AgentTaskPullConfig,
  AgentTaskPullExecutor,
  AgentTaskPullHttpClient,
  AgentTaskPullIdentity,
  AgentTaskPullStepResult,
  AgentTaskPullTask,
} from "./agent-task-pull-types";

type AgentTaskPullExecutionDeps = {
  executor?: AgentTaskPullExecutor;
  signal?: AbortSignal;
  ackRenewalIntervalMs?: number;
};

export async function executeAgentTaskPullTask(
  identity: AgentTaskPullIdentity,
  task: AgentTaskPullTask,
  config: AgentTaskPullConfig,
  client: AgentTaskPullHttpClient,
  deps: AgentTaskPullExecutionDeps,
) {
  const executor = deps.executor || executeAgentTaskPullStep;
  const results: AgentTaskPullStepResult[] = [];
  if (task.dryRun) {
    const dryRunResults = buildAgentTaskPullDryRunResults(task);
    const finalAck = await client.ack(identity, task.jobId, {
      message: "Dry-run task command steps skipped",
      percent: 100,
    });
    if (finalAck.cancellation?.shouldStop) {
      return buildAgentTaskPullExecutionResult(
        "cancelled",
        dryRunResults,
        finalAck.cancellation.reason || "server_cancellation",
      );
    }
    return buildAgentTaskPullExecutionResult("completed", dryRunResults);
  }

  for (const [index, step] of task.commandSteps.entries()) {
    if (deps.signal?.aborted) {
      return buildAgentTaskPullExecutionResult("cancelled", results, "signal");
    }
    const stepProgress = {
      stepKey: step.key,
      message: `Running ${step.label || step.key}`,
      percent: percent(index, task.commandSteps.length),
    };
    const ack = await client.ack(identity, task.jobId, stepProgress);
    const ackRejection = readAgentTaskPullAckRejectionReason(ack);
    if (ackRejection) {
      return buildAgentTaskPullExecutionResult(
        "cancelled",
        results,
        ackRejection,
      );
    }
    if (ack.cancellation?.shouldStop) {
      return buildAgentTaskPullExecutionResult(
        "cancelled",
        results,
        ack.cancellation.reason,
      );
    }

    const stepControl = createLinkedAbortController(deps.signal);
    let cancellationReason: string | undefined;
    const stopRenewal = startAgentTaskPullStepAckRenewal({
      client,
      identity,
      jobId: task.jobId,
      ...stepProgress,
      signal: stepControl.signal,
      intervalMs: deps.ackRenewalIntervalMs,
      abort: (reason) => {
        cancellationReason = reason;
        stepControl.abort(reason);
      },
    });
    let result: AgentTaskPullStepResult;
    try {
      result = await executor(step, {
        cwd: config.cwd,
        signal: stepControl.signal,
        forceKillGraceMs: config.forceKillGraceMs,
      });
    } finally {
      stopRenewal();
      stepControl.cleanup();
    }
    results.push(result);
    if (result.cancelled) {
      return buildAgentTaskPullExecutionResult(
        "cancelled",
        results,
        cancellationReason || "signal",
      );
    }
    if (step.required !== false && result.timedOut) {
      return buildAgentTaskPullExecutionResult(
        "failed",
        results,
        `step_timeout:${step.key}`,
      );
    }
    if (step.required !== false && result.exitCode !== 0) {
      return buildAgentTaskPullExecutionResult(
        "failed",
        results,
        `step_failed:${step.key}`,
      );
    }
  }

  const finalAck = await client.ack(identity, task.jobId, {
    message: "Task command steps completed",
    percent: 100,
  });
  if (finalAck.cancellation?.shouldStop) {
    return buildAgentTaskPullExecutionResult(
      "cancelled",
      results,
      finalAck.cancellation.reason || "server_cancellation",
    );
  }
  return buildAgentTaskPullExecutionResult("completed", results);
}
