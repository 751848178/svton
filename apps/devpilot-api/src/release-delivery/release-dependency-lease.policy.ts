import { createHash, randomBytes } from "node:crypto";

export const DEPENDENCY_FETCH_LEASE_MS = 30_000;

export function createDependencyFetchLease(now = new Date()) {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: dependencyFetchLeaseTokenHash(token),
    expiresAt: new Date(now.getTime() + DEPENDENCY_FETCH_LEASE_MS) };
}

export function dependencyFetchLeaseTokenHash(token: string) {
  return createHash("sha256").update("dependency-fetch-lease-v1:")
    .update(token).digest("hex");
}
