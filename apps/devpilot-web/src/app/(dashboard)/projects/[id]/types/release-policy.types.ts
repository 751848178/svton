export type ReleaseStrategy =
  | 'standard'
  | 'canary'
  | 'blue_green'
  | 'automatic_traffic';

export interface ReleaseStrategyCapability {
  strategy: ReleaseStrategy;
  executable: boolean;
  reasonCode: string;
  reason: { zh: string; en: string };
  missingCapabilities: string[];
}

export interface ReleasePolicyRevision {
  id: string | null;
  revision: number;
  strategy: ReleaseStrategy;
  requireProductionApproval: boolean;
  snapshotHash: string;
  synthetic?: boolean;
}

export interface ReleasePolicyResponse {
  current: ReleasePolicyRevision;
  capabilities: ReleaseStrategyCapability[];
}
