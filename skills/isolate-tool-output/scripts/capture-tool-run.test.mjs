import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("./capture-tool-run.mjs", import.meta.url),
);

function runCapture(logDir, extraArgs, source) {
  return spawnSync(
    process.execPath,
    [
      script,
      "--project",
      "capture-test",
      "--task",
      "case",
      "--log-dir",
      logDir,
      ...extraArgs,
      "--",
      process.execPath,
      "-e",
      source,
    ],
    { encoding: "utf8" },
  );
}

function withLogDir(run) {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "capture-tool-run-"));
  try {
    run(logDir);
  } finally {
    fs.rmSync(logDir, { force: true, recursive: true });
  }
}

test("returns successful small output without summary overhead", () => {
  withLogDir((logDir) => {
    const result = runCapture(logDir, [], 'console.log("small-output")');
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "small-output\n");
    assert.equal(result.stderr, "");
    assert.equal(fs.readdirSync(path.join(logDir, "capture-test")).length, 1);
  });
});

test("summarizes output above the default threshold", () => {
  withLogDir((logDir) => {
    const result = runCapture(
      logDir,
      [],
      'process.stdout.write("x".repeat(9000))',
    );
    assert.equal(result.status, 0);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.output_mode, "summary");
    assert.equal(summary.stdout_bytes, 9000);
    assert.equal(summary.summary_threshold_bytes, 8192);
    assert.ok(fs.existsSync(summary.full_log));
  });
});

test("preserves small failure output, exit code, and log location", () => {
  withLogDir((logDir) => {
    const result = runCapture(
      logDir,
      [],
      'console.error("failed-small"); process.exit(7)',
    );
    assert.equal(result.status, 7);
    assert.match(result.stderr, /failed-small/);
    assert.match(result.stderr, /\[capture\] exit_code=7/);
    assert.match(result.stderr, /full_log=/);
  });
});

test("always-summary keeps the structured compatibility contract", () => {
  withLogDir((logDir) => {
    const result = runCapture(
      logDir,
      ["--always-summary"],
      'console.log("small-output")',
    );
    assert.equal(result.status, 0);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.output_mode, "summary");
    assert.equal(summary.stdout_bytes, 13);
  });
});
