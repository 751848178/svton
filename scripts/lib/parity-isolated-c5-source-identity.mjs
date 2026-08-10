import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

export function requireC5SourceIdentity(root, expected) {
  const worktreeStatus = git(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=normal",
  ]).trim();
  if (worktreeStatus) {
    throw new Error("PARITY_C5_SOURCE_INVALID: dirty-worktree");
  }

  const revision = git(root, ["rev-parse", "HEAD"]).trim();
  const trackedIndex = git(root, ["ls-files", "-s"]);
  const treeSha256 = createHash("sha256")
    .update(`${revision}\n${trackedIndex}`)
    .digest("hex");
  if (
    expected &&
    (expected.revision !== revision || expected.treeSha256 !== treeSha256)
  ) {
    throw new Error("PARITY_C5_SOURCE_INVALID: identity-drift");
  }
  return Object.freeze({ revision, treeSha256 });
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "PARITY_C5_SOURCE_INVALID: git-failed");
  }
  return result.stdout;
}
