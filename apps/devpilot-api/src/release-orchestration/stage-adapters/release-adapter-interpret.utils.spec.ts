/**
 * interpret 层单测（F383 D7 step 3 / invest-2 §E.3）：
 * - toLogsText 归一化各种 logs 形态为真实换行连接的纯文本
 * - interpretServerCommandResult 在多行 logs（含哨兵）上正确解析
 */
import {
  toLogsText,
  interpretServerCommandResult,
  interpretDeploymentRunResult,
} from "./release-adapter-interpret.utils";

function b64url(obj: unknown): string {
  const b64 = Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("toLogsText", () => {
  it("passes string through unchanged", () => {
    expect(toLogsText("hello\nworld")).toBe("hello\nworld");
  });

  it("joins array of strings on real newlines", () => {
    expect(toLogsText(["line1", "line2", "line3"])).toBe("line1\nline2\nline3");
  });

  it("JSON-stringifies non-string array entries", () => {
    expect(toLogsText([{ level: "info" }, "ok"])).toBe(
      '{"level":"info"}\nok',
    );
  });

  it("reads .stdout from object logs", () => {
    expect(toLogsText({ stdout: "out\nout2" })).toBe("out\nout2");
  });

  it("reads .text/.output/.combined from object logs", () => {
    expect(toLogsText({ text: "t" })).toBe("t");
    expect(toLogsText({ output: "o" })).toBe("o");
    expect(toLogsText({ combined: "c" })).toBe("c");
  });

  it("recurses into .lines array", () => {
    expect(toLogsText({ lines: ["a", "b"] })).toBe("a\nb");
  });

  it("recurses into .entries array", () => {
    expect(toLogsText({ entries: ["x", "y"] })).toBe("x\ny");
  });

  it("returns empty string for undefined/null/number", () => {
    expect(toLogsText(undefined)).toBe("");
    expect(toLogsText(null)).toBe("");
    expect(toLogsText(42 as never)).toBe("");
  });

  it("returns empty string for object without known keys", () => {
    expect(toLogsText({ foo: "bar" })).toBe("");
  });
});

describe("interpretServerCommandResult sentinel parsing (regression)", () => {
  // 修复前：JSON.stringify(["@@DEVPILOT_OUTPUT@@ X"]) → '["@..."]' 单行，
  // 哨兵粘在引号里，parseOutputSentinel 的 after-slice 会带上尾随 `"]`。
  // 修复后：toLogsText 真实换行连接 → 哨兵独立成行，payload 干净。
  it("parses sentinel from array logs with real newlines", () => {
    const payload = b64url({
      schemaVersion: 1,
      summary: "ready",
      values: { ready: true, httpStatus: 200 },
    });
    const result = interpretServerCommandResult({
      status: "completed",
      logs: [
        "starting probe",
        `@@DEVPILOT_OUTPUT@@ ${payload}`,
        "done",
      ],
    });
    expect(result.status).toBe("succeeded");
    expect(result.output?.summary).toBe("ready");
    expect(result.output?.values?.ready).toBe(true);
    expect(result.output?.values?.httpStatus).toBe(200);
  });

  it("parses sentinel from object logs with stdout key", () => {
    const payload = b64url({
      schemaVersion: 1,
      summary: "ok",
      values: { count: 1 },
    });
    const result = interpretServerCommandResult({
      status: "completed",
      logs: { stdout: `@@DEVPILOT_OUTPUT@@ ${payload}` },
    });
    expect(result.output?.values?.count).toBe(1);
  });

  it("returns null output when no sentinel present", () => {
    const result = interpretServerCommandResult({
      status: "completed",
      logs: ["just a normal log line", "another"],
    });
    expect(result.output).toBeNull();
    expect(result.status).toBe("succeeded");
  });

  it("maps failed job status to failed result", () => {
    const result = interpretServerCommandResult({
      status: "failed",
      logs: ["err"],
      error: "exit 1",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("exit 1");
  });
});

describe("interpretDeploymentRunResult blocked-state sync", () => {
  it("maps completed deployment run to succeeded", () => {
    const result = interpretDeploymentRunResult({ status: "completed" });
    expect(result.status).toBe("succeeded");
  });

  it("maps failed deployment run to failed", () => {
    const result = interpretDeploymentRunResult({ status: "failed", error: "boom" });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("boom");
  });

  it("maps cancelled deployment run to skipped", () => {
    const result = interpretDeploymentRunResult({ status: "cancelled" });
    expect(result.status).toBe("skipped");
  });

  it("maps blocked-operation-approval to queued (legitimate wait)", () => {
    const result = interpretDeploymentRunResult({
      status: "blocked",
      result: { mode: "blocked_operation_approval" },
    });
    expect(result.status).toBe("queued");
  });

  it("maps blocked (non-approval, e.g. initialization-checkpoint) to failed (fail-closed)", () => {
    const result = interpretDeploymentRunResult({
      status: "blocked",
      error: "deployment-initialization-checkpoint",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("deployment-initialization-checkpoint");
  });

  it("maps blocked with no result mode to failed (fail-closed)", () => {
    const result = interpretDeploymentRunResult({ status: "blocked" });
    expect(result.status).toBe("failed");
    expect(result.error).toContain("阻塞");
  });
});
