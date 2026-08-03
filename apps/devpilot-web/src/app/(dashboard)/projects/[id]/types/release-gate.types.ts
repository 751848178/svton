export type ReleaseGateStatus =
  | 'checked'
  | 'unchecked'
  | 'blocked'
  | 'warning'
  | 'manual'
  | 'unavailable';

export type ReleaseGatePhase = 'commit' | 'build' | 'deploy' | 'promote';
export type LocalizedGateText = { zh: string; en: string };

export type ReleaseGateCheck = {
  id: string;
  phase: ReleaseGatePhase;
  ordinal: number;
  title: LocalizedGateText;
  dispositions: string[];
  capabilityId: string | null;
  delivery: 'mvp' | 'target';
  status: ReleaseGateStatus;
  providerKey: string | null;
  reasonCode: string;
  reason: LocalizedGateText;
  evidenceRef: string | null;
  checkedAt: string | null;
  expiresAt: string | null;
  fresh: boolean | null;
};

export type ReleaseGateCatalog = {
  catalogVersion: string;
  capabilityVersion: string;
  releaseOrder: { id: string; releaseVersion: string };
  summary: {
    total: number;
    phaseCounts: Record<ReleaseGatePhase, number>;
    statusCounts: Record<ReleaseGateStatus, number>;
  };
  capabilities: Array<{
    id: string;
    name: LocalizedGateText;
    available: boolean;
    providerKey: string | null;
    reasonCode: string;
    reason: LocalizedGateText;
  }>;
  checks: ReleaseGateCheck[];
};
