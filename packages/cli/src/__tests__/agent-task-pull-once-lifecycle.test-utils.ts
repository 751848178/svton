import type { AgentTaskPullHttpClient } from "../utils/agent-task-pull-types";

export function createLifecycleClient(): AgentTaskPullHttpClient & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
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
      return {
        claimed: true,
        task: {
          available: true,
          jobId: "job-1",
          operationKey: "deployment.run",
          commandSteps: [
            {
              key: "deploy",
              label: "Deploy",
              command: "echo deploy",
              required: true,
            },
          ],
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
}

export function baseLifecycleConfig(execute: boolean) {
  return {
    apiUrl: "https://devpilot.example.test",
    token: "token-1",
    teamId: "team-1",
    serverId: "server-1",
    agentId: "agent-1",
    capabilities: [],
    execute,
  };
}
