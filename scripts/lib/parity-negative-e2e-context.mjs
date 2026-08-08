import { readFile } from "node:fs/promises";
import { parseNegativeHistoryEvidence } from "./parity-negative-history-contract.mjs";

export async function loadNegativeHistoryContext(input) {
  if (!input?.evidencePath) throw new Error("history evidencePath missing");
  const bytes = await readFile(input.evidencePath);
  return parseNegativeHistoryEvidence(bytes, input);
}
