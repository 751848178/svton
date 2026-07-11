import type { AgentTaskPullHttpClient } from "../utils/agent-task-pull-types";

export function createLoopClient(modes: Array<"task" | "idle" | "disabled">) {
  const calls: string[] = [];
  const client: AgentTaskPullHttpClient & { calls: string[] } = {
    calls,
    async contract() {
      calls.push("contract");
      return {
        contract: {
          mode: "claim_ack_finish",
          claimedTaskLifecycleEnvelopeSupported: true,
          lifecycleEnvelope: { claimResponseField: "task.lifecycle" },
        },
      };
    },
    async claim() {
      calls.push("claim");
      const mode = modes.shift() || "idle";
      if (mode === "idle") return { claimed: false, reason: "empty_queue" };
      if (mode === "disabled") {
        return { claimed: false, reason: "task_pull_disabled" };
      }
      return {
        claimed: true,
        task: {
          available: true,
          jobId: `job-${calls.filter((call) => call === "claim").length}`,
          operationKey: "deployment.run",
          commandSteps: [{ key: "deploy", command: "echo deploy" }],
        },
      };
    },
    async ack() {
      calls.push("ack");
      return { acked: true, cancellation: null };
    },
    async finish(_identity, _jobId, payload) {
      calls.push(`finish:${payload.status}`);
      return { finished: true };
    },
  };
  return client;
}

export function baseLoopConfig(bounds: {
  maxIterations: number;
  idleLimit?: number;
}) {
  return {
    apiUrl: "https://devpilot.example.test",
    token: "token-1",
    teamId: "team-1",
    serverId: "server-1",
    agentId: "agent-1",
    capabilities: [],
    execute: true,
    intervalMs: 0,
    ...bounds,
  };
}
