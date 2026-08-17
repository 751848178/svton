import type {
  LocalizedText,
  ReleaseGateCapabilityId,
  ReleaseGateDefinition,
  ReleaseGateStatus,
} from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";

export type ReleaseGateProviderResult = {
  status: ReleaseGateStatus;
  reasonCode: string;
  reason: LocalizedText;
  evidenceRef: string | null;
  checkedAt: string | null;
  expiresAt: string | null;
  fresh: boolean | null;
  evidenceIdentity?: Record<string, string | number | null>;
};

export interface ReleaseGateCapabilityProvider {
  readonly providerKey: string;
  readonly capabilityIds: ReleaseGateCapabilityId[];
  available(
    capabilityId: ReleaseGateCapabilityId,
    context: ReleaseGateEvidenceContext,
  ): boolean;
  evaluate(
    definition: ReleaseGateDefinition,
    context: ReleaseGateEvidenceContext,
    now: Date,
  ): ReleaseGateProviderResult;
}

export function unavailable(
  reasonCode: string,
  zh: string,
  en: string,
): ReleaseGateProviderResult {
  return {
    status: "unavailable",
    reasonCode,
    reason: { zh, en },
    evidenceRef: null,
    checkedAt: null,
    expiresAt: null,
    fresh: null,
  };
}

export function evaluated(input: {
  status: ReleaseGateStatus;
  reasonCode: string;
  zh: string;
  en: string;
  evidenceRef: string;
  checkedAt: Date;
  ttlMs?: number;
  now: Date;
  evidenceIdentity?: Record<string, string | number | null>;
}): ReleaseGateProviderResult {
  const expiresAt = input.ttlMs
    ? new Date(input.checkedAt.getTime() + input.ttlMs)
    : null;
  const fresh = !expiresAt || expiresAt.getTime() >= input.now.getTime();
  return {
    status: fresh ? input.status : "unchecked",
    reasonCode: fresh ? input.reasonCode : "evidence_stale",
    reason: fresh
      ? { zh: input.zh, en: input.en }
      : {
          zh: `证据已于 ${expiresAt?.toISOString()} 过期，必须重新检查`,
          en: `Evidence expired at ${expiresAt?.toISOString()} and must be checked again`,
        },
    evidenceRef: input.evidenceRef,
    checkedAt: input.checkedAt.toISOString(),
    expiresAt: expiresAt?.toISOString() ?? null,
    fresh,
    evidenceIdentity: input.evidenceIdentity,
  };
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
