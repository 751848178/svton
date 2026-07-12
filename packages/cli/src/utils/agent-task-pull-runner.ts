import type {
  AgentTaskPullConfig,
  AgentTaskPullHttpClient,
  AgentTaskPullExecutor,
  AgentTaskPullRunSummary,
} from "./agent-task-pull-types";
import { HttpAgentTaskPullClient } from "./agent-task-pull-client";
import { finishAgentTaskPullExecution } from "./agent-task-pull-finish.utils";
import {
  assertAgentTaskPullLifecycleSupported,
  toAgentTaskPullIdentity,
} from "./agent-task-pull-lifecycle.utils";
import { executeAgentTaskPullTask } from "./agent-task-pull-task-execution.service";

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

  const executed = await executeAgentTaskPullTask(
    identity,
    claim.task,
    config,
    client,
    deps,
  );
  return finishAgentTaskPullExecution(client, identity, claim.task, executed);
}
