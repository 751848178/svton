// F438: Production route activation + real site probes — shared port/types.
// Zero-secret: probe evidence never includes credentials or private key material.

export interface FrozenRouteSnapshot {
  entries?: unknown;
  domains?: unknown;
  dnsProvider?: unknown;
  tlsRequired?: unknown;
  proxyTarget?: unknown;
  [key: string]: unknown;
}

export interface FrozenRouteEntry {
  domain: string;
  path: string;
  serviceId: string;
  component: string;
  port: number;
  tlsMode: "managed_cert" | "existing_cert_asset";
}

export interface SiteRouteActivationResolveInput {
  teamId: string;
  projectId: string;
  environmentId: string;
  routeSnapshot?: FrozenRouteSnapshot | null;
}

export interface SiteRouteActivationResolveResult {
  siteId: string | null;
  primaryDomain: string | null;
  domains: string[];
  entries: FrozenRouteEntry[];
  proxyTarget: string | null;
  status: "matched" | "unavailable";
  reasonCode:
    | "site_route_matched"
    | "no_route_domains"
    | "route_target_unverified"
    | "multiple_route_upstreams"
    | "site_not_found"
    | "site_environment_mismatch"
    | "site_not_active"
    | "multiple_route_sites"
    | "route_not_frozen";
}

export abstract class SiteRouteActivationPort {
  abstract resolve(
    input: SiteRouteActivationResolveInput,
  ): Promise<SiteRouteActivationResolveResult>;
}

export interface SiteProbeInput {
  teamId: string;
  projectId: string;
  environmentId: string;
  deploymentRunId: string;
  primaryDomain: string | null;
  tlsRequired?: boolean | null;
  targetRef?: string | null;
  timeoutMs?: number;
}

export interface SiteProbeBlock {
  status: string;
  hostname?: string | null;
  records?: string[];
  error?: { code: string; message: string } | null;
  checkedAt: string;
}

export interface SiteProbeTlsBlock {
  status: string;
  host?: string | null;
  port?: number | null;
  servername?: string | null;
  peerAddress?: string | null;
  authorized?: boolean | null;
  authorizationErrorCode?: string | null;
  cert?: {
    subject?: string | null;
    issuer?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    expired?: boolean | null;
    fingerprint256?: string | null;
  } | null;
  error?: { code: string; message: string } | null;
  checkedAt: string;
}

export interface SiteProbeHttpBlock {
  status: string;
  url: string | null;
  finalUrl: string | null;
  statusCode?: number | null;
  bodySignature?: string | null;
  error?: { code: string; message: string } | null;
  checkedAt: string;
}

export interface SiteProbeResult {
  version: 1;
  primaryDomain: string | null;
  finalUrl: string | null;
  probedAt: string;
  dns: SiteProbeBlock;
  tls: SiteProbeTlsBlock;
  http: SiteProbeHttpBlock;
}

export abstract class SiteProbePort {
  abstract probe(input: SiteProbeInput): Promise<SiteProbeResult>;
}
