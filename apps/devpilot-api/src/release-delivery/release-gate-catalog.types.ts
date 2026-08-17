export const RELEASE_GATE_CATALOG_VERSION = "v13.2026-08-03";
export const RELEASE_GATE_CAPABILITY_VERSION = "mvp15.2026-08-03";

export const RELEASE_GATE_STATUSES = [
  "checked",
  "unchecked",
  "blocked",
  "warning",
  "manual",
  "unavailable",
] as const;

export type ReleaseGateStatus = (typeof RELEASE_GATE_STATUSES)[number];
export type ReleaseGatePhase = "commit" | "build" | "deploy" | "promote";
export type ReleaseGateCapabilityId = `M${string}`;

export type LocalizedText = { zh: string; en: string };

export type ReleaseGateDefinition = {
  id: string;
  phase: ReleaseGatePhase;
  ordinal: number;
  title: LocalizedText;
  dispositions: string[];
  capabilityId: ReleaseGateCapabilityId | null;
  delivery: "mvp" | "target";
};

export type ReleaseGateCapabilityDefinition = {
  id: ReleaseGateCapabilityId;
  name: LocalizedText;
};

export type ReleaseGateEvaluation = ReleaseGateDefinition & {
  status: ReleaseGateStatus;
  providerKey: string | null;
  reasonCode: string;
  reason: LocalizedText;
  evidenceRef: string | null;
  checkedAt: string | null;
  expiresAt: string | null;
  fresh: boolean | null;
  evidenceIdentity?: Record<string, string | number | null>;
};
