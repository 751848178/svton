import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PARITY_FIXTURE_MARKER_VERSION } from "./parity-fixture-author-marker.mjs";

export async function readParityFixturePinnedCommit(env = process.env) {
  const fixtureRoot = resolve(
    env.PARITY_FIXTURE_GIT_ROOT ||
      "/tmp/codex-tool-runs/svton/f454/parity-app-git",
  );
  const marker = JSON.parse(
    await readFile(resolve(fixtureRoot, ".parity-pinned-commit.json"), "utf8"),
  );
  if (
    marker.schemaVersion !== PARITY_FIXTURE_MARKER_VERSION ||
    !/^[a-f0-9]{40}$/.test(marker.pinnedCommit || "")
  ) {
    throw new Error("PARITY_FIXTURE_MARKER_INVALID");
  }
  return marker.pinnedCommit;
}
