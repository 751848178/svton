#!/usr/bin/env node
import { runHistoryChain } from "./lib/parity-history-chain-launcher.mjs";

runHistoryChain()
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  })
  .catch((error) => {
    process.stderr.write(`[f537] FAILED: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
