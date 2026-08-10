import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHistoryBrowserSession } from "./parity-history-browser-session.mjs";
import {
  browserSecretReference,
  readBrowserSecretsFd,
} from "./parity-history-browser-secret-capability.mjs";
import { NODE_CODE_INJECTION_ENV } from "./parity-trusted-node-environment.mjs";

const fixtureRoot = await mkdtemp(join(tmpdir(), "history-browser-session-"));
const trustedRootPath = join(fixtureRoot, "trusted");
await mkdir(trustedRootPath);
const trustedRoot = await realpath(trustedRootPath);

await assert.rejects(
  runHistoryBrowserSession({
    actions: [
      `setValue:input[type=password]@@@${browserSecretReference("password")}`,
      "text:proof.txt",
    ],
    secrets: { password: "argv-secret-sentinel" },
    trustedRoot,
    driver: "/fixture/driver.mjs",
    width: 1484,
    height: 1324,
    timeout: 1000,
    logPath: join(fixtureRoot, "driver.log"),
    runtime: {
      spawnSync(_command, args, options) {
        assert.doesNotMatch(args.join("\n"), /argv-secret-sentinel/);
        const secretFdIndex = Number(args[args.indexOf("--secret-fd") + 1]);
        assert.equal(secretFdIndex, options.stdio.length - 1);
        assert.equal(
          readBrowserSecretsFd(options.stdio[secretFdIndex]).password,
          "argv-secret-sentinel",
        );
        return { status: 1, stdout: "", stderr: "injected child failure" };
      },
      env: {},
    },
  }),
  /browser pass failed \(1\): injected child failure/,
);
assert.deepEqual(await readdir(trustedRoot), []);

for (const name of NODE_CODE_INJECTION_ENV) {
  await assert.rejects(
    runHistoryBrowserSession({
      actions: ["text:proof.txt"],
      secrets: { password: "secret" },
      trustedRoot,
      driver: "/fixture/driver.mjs",
      width: 100,
      height: 100,
      timeout: 1000,
      logPath: join(fixtureRoot, "driver.log"),
      runtime: { env: { [name]: "injected" }, spawnSync: assert.fail },
    }),
    new RegExp(name),
  );
}

await rm(fixtureRoot, { recursive: true });
console.log("parity history browser session self-test passed");
