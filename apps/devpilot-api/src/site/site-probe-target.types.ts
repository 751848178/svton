export interface SiteProbeTarget {
  url: string;
  protocol: "http:" | "https:";
  hostname: string;
  port: number;
  hostHeader: string;
  path: string;
}

export interface SiteProbeAddress {
  address: string;
  family: 4 | 6;
}

export interface ApprovedSiteProbeTarget extends SiteProbeTarget {
  address: string;
  family: 4 | 6;
  addresses: readonly SiteProbeAddress[];
}

export type SiteProbeLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<readonly SiteProbeAddress[]>;
