import type { SiteProbeBlock, SiteProbeResult, SiteProbeTlsBlock } from "./site-route-activation.types";

export interface SiteRouteSwitchInput {
  version: 1;
  operationId: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  siteId: string;
  deploymentRunId: string;
  releaseRunId: string | null;
  primaryDomain: string;
  domains: string[];
  proxyTarget: string | null;
  targetRef: string;
  routeHash: string;
}

export interface SiteRouteSwitchObservation {
  siteId: string;
  deploymentRunId: string;
  targetRef: string;
  routeHash: string;
}

export interface SiteRouteSwitchReceipt {
  version: 1;
  providerKey: string;
  operationId: string;
  status: "switched" | "unavailable" | "failed";
  reasonCode: string;
  observedAt: string | null;
  observed: SiteRouteSwitchObservation | null;
}

export interface SiteRouteSwitchProviderIdentity {
  readonly providerKey: string;
  readonly receiptVersion: SiteRouteSwitchReceipt["version"];
}

export interface SiteRouteSwitchEvidence extends SiteRouteSwitchInput {
  providerKey: string;
  status: SiteRouteSwitchReceipt["status"];
  reasonCode: string;
  switchedAt: string | null;
  receipt: SiteRouteSwitchReceipt;
}

export interface SiteRouteSwitchAttemptPersistence {
  evidence: SiteRouteSwitchEvidence;
  siteProbe?: SiteProbeResult;
  dnsProbe?: SiteProbeBlock;
  tlsProbe?: SiteProbeTlsBlock;
}
