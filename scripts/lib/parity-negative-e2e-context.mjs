import { parseNegativeHistoryEvidence } from "./parity-negative-history-contract.mjs";
import {
  HISTORY_CHAIN_CONSUMER,
  LEGACY_HISTORY_INPUTS,
} from "./parity-history-chain-paths.mjs";
import { readHistoryChainReceipt } from "./parity-history-chain-receipt-reader.mjs";

export async function loadNegativeHistoryContext(input) {
  if (
    !Number.isInteger(input?.evidenceFd) ||
    !Number.isInteger(input?.receiptFd)
  ) {
    throw new Error("trusted history chain descriptors missing");
  }
  const trusted = readHistoryChainReceipt(input);
  return parseNegativeHistoryEvidence(trusted.bytes, trusted.parserInput);
}

export function negativeHistoryInputFromEnvironment(env) {
  if (env[HISTORY_CHAIN_CONSUMER] !== "1") {
    throw new Error("trusted history chain consumer marker missing");
  }
  for (const name of LEGACY_HISTORY_INPUTS) {
    if (env[name] !== undefined)
      throw new Error(`legacy history input forbidden: ${name}`);
  }
  return Object.freeze({ evidenceFd: 3, receiptFd: 4 });
}
