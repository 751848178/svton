import { runAgentTaskPullOnce } from "../utils/agent-task-pull-runner";
import {
  baseLifecycleConfig,
  createLifecycleClient,
} from "./agent-task-pull-once-lifecycle.test-utils";

describe("agent task-pull once lifecycle", () => {
  it("reads contract only unless execute is explicit", async () => {
    const client = createLifecycleClient();

    const summary = await runAgentTaskPullOnce(baseLifecycleConfig(false), {
      client,
    });

    expect(summary).toEqual({
      mode: "contract_only",
      reason: "claim_ack_finish",
    });
    expect(client.calls).toEqual(["contract"]);
  });

  it("claims, acks, executes, and finishes one task when enabled", async () => {
    const client = createLifecycleClient();
    let forceKillGraceMs: number | undefined;

    const summary = await runAgentTaskPullOnce(baseLifecycleConfig(true), {
      client,
      executor: async (step, options) => {
        forceKillGraceMs = options.forceKillGraceMs;
        return {
          key: step.key,
          command: step.command,
          exitCode: 0,
          durationMs: 5,
          stdout: "ok",
          stderr: "",
          timedOut: false,
        };
      },
    });

    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "completed",
      stepCount: 1,
    });
    expect(client.calls).toEqual([
      "contract",
      "claim",
      "ack",
      "ack",
      "finish:completed",
    ]);
    expect(forceKillGraceMs).toBeUndefined();
  });

  it("does not execute a command when the step ack is rejected", async () => {
    const client = createLifecycleClient();
    let executed = false;
    let finishPayload: unknown;
    client.ack = async () => {
      client.calls.push("ack");
      return { acked: false, reason: "claimed_job_not_found_or_lock_mismatch" };
    };
    client.finish = async (_identity, _jobId, payload) => {
      client.calls.push(`finish:${payload.status}`);
      finishPayload = payload;
      return {
        accepted: true,
        finished: false,
        reason: "claimed_job_not_found_or_lock_mismatch",
      };
    };

    const summary = await runAgentTaskPullOnce(baseLifecycleConfig(true), {
      client,
      executor: async (step) => {
        executed = true;
        return {
          key: step.key,
          command: step.command,
          exitCode: 0,
          durationMs: 1,
          stdout: "should-not-run",
          stderr: "",
          timedOut: false,
        };
      },
    });

    expect(executed).toBe(false);
    expect(summary).toEqual({
      mode: "executed",
      jobId: "job-1",
      status: "cancelled",
      stepCount: 1,
      reason: "claimed_job_not_found_or_lock_mismatch",
      finishAccepted: true,
      finishFinished: false,
      finishReason: "claimed_job_not_found_or_lock_mismatch",
    });
    expect(finishPayload).toMatchObject({
      status: "cancelled",
      error: "claimed_job_not_found_or_lock_mismatch",
    });
    expect(client.calls).toEqual([
      "contract",
      "claim",
      "ack",
      "finish:cancelled",
    ]);
  });
});
