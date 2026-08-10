import { createHash } from "node:crypto";

export function assertEvidenceReceiptMatches(receipt, buffer) {
  const actual = Buffer.isBuffer(buffer)
    ? createHash("sha256").update(buffer).digest("hex")
    : null;
  if (receipt?.sha256 !== actual) {
    throw new Error("E2E_DRIVER_STDOUT_INVALID: evidence-sha-mismatch");
  }
  return buffer;
}
