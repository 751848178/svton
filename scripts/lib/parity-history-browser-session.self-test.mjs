import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHistoryBrowserSession } from "./parity-history-browser-session.mjs";

const fixtureRoot = await mkdtemp(join(tmpdir(), "history-browser-session-"));
const trustedRootPath = join(fixtureRoot, "trusted");
await mkdir(trustedRootPath);
const trustedRoot = await realpath(trustedRootPath);

await assert.rejects(
  runHistoryBrowserSession({
    actions: ["text:proof.txt"],
    trustedRoot,
    driver: "/fixture/driver.mjs",
    width: 1484,
    height: 1324,
    timeout: 1000,
    logPath: join(fixtureRoot, "driver.log"),
    runtime: {
      spawnSync() {
        return { status: 1, stdout: "", stderr: "injected child failure" };
      },
    },
  }),
  /browser pass failed \(1\): injected child failure/,
);
assert.deepEqual(await readdir(trustedRoot), []);

await rm(fixtureRoot, { recursive: true });
console.log("parity history browser session self-test passed");
