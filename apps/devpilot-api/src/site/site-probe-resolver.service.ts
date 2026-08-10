import { Injectable, Optional } from "@nestjs/common";
import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { withProbeTimeout } from "./site-probe-error";
import {
  isPublicSiteProbeAddress,
  parseSiteProbeTarget,
  targetError,
} from "./site-probe-target.policy";
import type {
  ApprovedSiteProbeTarget,
  SiteProbeAddress,
  SiteProbeLookup,
} from "./site-probe-target.types";
import { SiteProbeLocalAcceptancePolicy } from "./site-probe-local-acceptance.policy";

const systemLookup: SiteProbeLookup = (hostname, options) =>
  dns.lookup(hostname, options) as Promise<SiteProbeAddress[]>;

@Injectable()
export class SiteProbeResolverService {
  private readonly lookup: SiteProbeLookup;
  private readonly localAcceptance: SiteProbeLocalAcceptancePolicy;

  constructor(
    @Optional() lookup?: SiteProbeLookup,
    @Optional() localAcceptance?: SiteProbeLocalAcceptancePolicy,
  ) {
    this.lookup = lookup ?? systemLookup;
    this.localAcceptance =
      localAcceptance ?? new SiteProbeLocalAcceptancePolicy();
  }

  async resolve(
    value: string,
    timeoutMs: number,
  ): Promise<ApprovedSiteProbeTarget> {
    const target = parseSiteProbeTarget(value);
    const family = isIP(target.hostname);
    const addresses = family
      ? [{ address: target.hostname, family: family as 4 | 6 }]
      : await this.lookupOnce(target.hostname, timeoutMs);
    if (addresses.length === 0) {
      throw targetError(
        "SITE_PROBE_DNS_EMPTY",
        "site probe DNS answer is empty",
      );
    }
    const containsForbiddenAddress = addresses.some(
      ({ address, family }) =>
        isIP(address) !== family || !isPublicSiteProbeAddress(address),
    );
    if (
      containsForbiddenAddress &&
      !this.localAcceptance.allows(target, addresses)
    ) {
      throw targetError(
        "SITE_PROBE_ADDRESS_FORBIDDEN",
        "site probe DNS answer contains a non-public address",
      );
    }
    const selected = addresses[0];
    return { ...target, ...selected, addresses };
  }

  private lookupOnce(hostname: string, timeoutMs: number) {
    return withProbeTimeout(
      this.lookup(hostname, { all: true, verbatim: true }),
      timeoutMs,
      "SITE_PROBE_DNS_TIMEOUT",
    );
  }
}
