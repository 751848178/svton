import { createHash, randomBytes, randomUUID } from "node:crypto";

export const PRODUCTION_PROMOTION_LEASE_MS = 30_000;

export class ProductionPromotionLeaseLostError extends Error {
  constructor() { super("PRODUCTION_PROMOTION_LEASE_LOST"); }
}

export class ProductionPromotionRecoveryPendingError extends Error {
  constructor() { super("PRODUCTION_PROMOTION_RECOVERY_PENDING_READBACK"); }
}

export type ProductionPromotionLease = {
  owner: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

export function createProductionPromotionLease(
  now = new Date(),
  durationMs = PRODUCTION_PROMOTION_LEASE_MS,
): ProductionPromotionLease {
  const token = randomBytes(32).toString("hex");
  return {
    owner: `promotion-${process.pid}-${randomUUID()}`,
    token,
    tokenHash: productionPromotionLeaseTokenHash(token),
    expiresAt: new Date(now.getTime() + durationMs),
  };
}

export function productionPromotionLeaseTokenHash(token: string) {
  return createHash("sha256")
    .update("production-promotion-lease-v1:")
    .update(token)
    .digest("hex");
}

export function promotionLeaseIsActive(
  leaseExpiresAt: Date | null,
  now = new Date(),
) {
  return Boolean(leaseExpiresAt && leaseExpiresAt.getTime() > now.getTime());
}
