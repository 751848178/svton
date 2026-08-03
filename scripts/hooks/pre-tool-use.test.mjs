import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const hook = fileURLToPath(new URL("./pre-tool-use.mjs", import.meta.url));
const repo = fileURLToPath(new URL("../..", import.meta.url));

function runHook(toolName, toolInput) {
  return spawnSync(process.execPath, [hook], {
    cwd: repo,
    encoding: "utf8",
    input: JSON.stringify({
      tool_name: toolName,
      cwd: repo,
      tool_input: toolInput,
    }),
  });
}

test("allows a bounded direct command", () => {
  const result = runHook("exec_command", { cmd: "git status --short" });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
});

test("blocks raw diffs through the direct cmd payload", () => {
  const result = runHook("exec_command", { cmd: "git diff -- src docs" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /raw-git-diff/);
  assert.match(result.stderr, /diff-summary/);
});

test("blocks broad search nested in functions.exec source", () => {
  const source = [
    "const result = await tools.exec_command({",
    '  cmd: "rg -n \\"alpha|beta\\" apps packages",',
    "});",
    "text(result.output);",
  ].join("\n");
  const result = runHook("functions.exec", { source });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /raw-broad-search/);
  assert.match(result.stderr, /smart-rg/);
});

test("extracts multiple nested static commands", () => {
  const source = [
    "await Promise.all([",
    '  tools.exec_command({"cmd":"git status --short"}),',
    '  tools.exec_command({"cmd":"git diff -- packages"}),',
    "]);",
  ].join("\n");
  const result = runHook("exec", source);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /raw-git-diff/);
});

test("honors the explicit token-guard escape hatch", () => {
  const result = runHook("Bash", {
    command: "git diff -- src # noqa token-guard",
  });
  assert.equal(result.status, 0);
});
