import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireC5SourceIdentity } from "./parity-isolated-c5-source-identity.mjs";

const root = await realpath(
  await mkdtemp(join(tmpdir(), "c5-source-identity-")),
);
try {
  git(["init", "--quiet"]);
  git(["config", "user.email", "parity@example.test"]);
  git(["config", "user.name", "Parity Acceptance"]);
  await writeFile(join(root, "source.txt"), "initial\n");
  git(["add", "source.txt"]);
  git(["commit", "--quiet", "-m", "initial"]);

  const expected = requireC5SourceIdentity(root);
  assert.deepEqual(requireC5SourceIdentity(root, expected), expected);

  await writeFile(join(root, "source.txt"), "modified\n");
  assert.throws(
    () => requireC5SourceIdentity(root, expected),
    /dirty-worktree/,
  );
  git(["restore", "source.txt"]);

  await writeFile(join(root, "untracked.txt"), "untracked\n");
  assert.throws(
    () => requireC5SourceIdentity(root, expected),
    /dirty-worktree/,
  );
  await rm(join(root, "untracked.txt"));

  await writeFile(join(root, "source.txt"), "next\n");
  git(["add", "source.txt"]);
  git(["commit", "--quiet", "-m", "next"]);
  assert.throws(
    () => requireC5SourceIdentity(root, expected),
    /identity-drift/,
  );
} finally {
  await rm(root, { recursive: true });
}

console.log("isolated C5 source identity self-test passed");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}
