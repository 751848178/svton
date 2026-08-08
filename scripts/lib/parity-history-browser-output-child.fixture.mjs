#!/usr/bin/env node
import { decodeBrowserOutputPlan } from "./parity-history-browser-output-plan.mjs";
import { writeBrowserOutputFd } from "./parity-history-browser-output-fd.mjs";

const plan = decodeBrowserOutputPlan(process.argv[2]);
writeBrowserOutputFd(
  plan.outputs,
  "proof.txt",
  Buffer.from("child descriptor proof"),
);
writeBrowserOutputFd(
  plan.outputs,
  "cdp-evidence.json",
  Buffer.from("child descriptor evidence"),
);
process.stdout.write(`${plan.runNonce}\n`);
