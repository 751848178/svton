import type {
  AgentTaskPullConfig,
  AgentTaskPullFinishStatus,
  AgentTaskPullHttpClient,
  AgentTaskPullIdentity,
  AgentTaskPullRunSummary,
  AgentTaskPullTask,
} from "./agent-task-pull-types";
import {
  AgentTaskPullExecutor,
  AgentTaskPullStepResult,
  executeAgentTaskPullStep,
} from "./agent-task-pull-executor";
import { HttpAgentTaskPullClient } from "./agent-task-pull-client";
import { readAgentTaskPullAckRejectionReason } from "./agent-task-pull-ack.utils";
import { buildAgentTaskPullDryRunResults } from "./agent-task-pull-dry-run.utils";
import { finishAgentTaskPullExecution } from "./agent-task-pull-finish.utils";
import {
  assertAgentTaskPullLifecycleSupported,
  toAgentTaskPullIdentity,
} from "./agent-task-pull-lifecycle.utils";
import {
  createLinkedAbortController,
  startAgentTaskPullStepAckRenewal,
} from "./agent-task-pull-step-control";
import {
  buildAgentTaskPullExecutionResult,
  percent,
} from "./agent-task-pull-result.utils";

export type { AgentTaskPullRunSummary };

export async function runAgentTaskPullOnce(
  config: AgentTaskPullConfig,
  deps: {
    client?: AgentTaskPullHttpClient;
    executor?: AgentTaskPullExecutor;
    signal?: AbortSignal;
    ackRenewalIntervalMs?: number;
  } = {},
): Promise<AgentTaskPullRunSummary> {
  const client = deps.client || new HttpAgentTaskPullClient(config);
  const identity = toAgentTaskPullIdentity(config);
  const contract = await client.contract(identity);

  if (!config.execute) {
    return {
      mode: "contract_only",
      reason: contract.contract?.mode || "contract_read",
    };
  }
  assertAgentTaskPullLifecycleSupported(contract.contract);

  const claim = await client.claim(identity);
  if (!claim.claimed || !claim.task?.available) {
    return { mode: "no_task", reason: claim.reason || "no_task_claimed" };
  }

  const executed = await executeTask(
    identity,
    claim.task,
    config,
    client,
    deps,
  );
  return finishAgentTaskPullExecution(client, identity, claim.task, executed);
}

async function executeTask(
  identity: AgentTaskPullIdentity,
  task: AgentTaskPullTask,
  config: AgentTaskPullConfig,
  client: AgentTaskPullHttpClient,
  deps: {
    executor?: AgentTaskPullExecutor;
    signal?: AbortSignal;
    ackRenewalIntervalMs?: number;
  },
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
    const ack = await client.ack(identity, task.jobId, {
      stepKey: step.key,
      message: `Running ${step.label || step.key}`,
      percent: percent(index, task.commandSteps.length),
    });
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
      stepKey: step.key,
      message: `Running ${step.label || step.key}`,
      percent: percent(index, task.commandSteps.length),
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
