import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("./session-health-check.mjs", import.meta.url),
);

function tokenEvent(inputTokens) {
  return {
    timestamp: new Date().toISOString(),
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        last_token_usage: {
          input_tokens: inputTokens,
          cached_input_tokens: 0,
          output_tokens: 100,
          total_tokens: inputTokens + 100,
        },
        total_token_usage: {
          input_tokens: inputTokens,
          cached_input_tokens: 0,
          output_tokens: 100,
          total_tokens: inputTokens + 100,
        },
      },
    },
  };
}

function runHealth(lines) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "session-health-"));
  const session = path.join(root, "rollout.jsonl");
  fs.writeFileSync(session, `${lines.map(JSON.stringify).join("\n")}\n`);
  try {
    const result = spawnSync(process.execPath, [script, "--session", session], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

test("continues below both thresholds", () => {
  const result = runHealth([tokenEvent(90_000)]);
  assert.equal(result.action, "continue");
  assert.deepEqual(result.reasons, []);
});

test("splits when last input exceeds 120K", () => {
  const result = runHealth([tokenEvent(120_001)]);
  assert.equal(result.action, "wrap_and_split");
  assert.match(result.reasons[0], /last_input/);
});

test("splits after the first compaction", () => {
  const result = runHealth([
    tokenEvent(80_000),
    { type: "compacted", timestamp: new Date().toISOString() },
  ]);
  assert.equal(result.action, "wrap_and_split");
  assert.equal(result.compaction_count, 1);
});
