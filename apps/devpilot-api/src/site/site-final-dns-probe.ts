import type { SiteProbeBlock } from "./site-route-activation.types";
import { probeError } from "./site-probe-error";
import type { ApprovedSiteProbeTarget } from "./site-probe-target.types";

export function probeFinalDns(
  target: ApprovedSiteProbeTarget | null,
  error?: unknown,
): SiteProbeBlock {
  const checkedAt = new Date().toISOString();
  if (!target) {
    return {
      status: "unavailable",
      hostname: null,
      error: error
        ? probeError(error)
        : { code: "NO_DOMAIN", message: "no route domain to resolve" },
      checkedAt,
    };
  }
  return {
    status: "resolved",
    hostname: target.hostname,
    records: target.addresses.map(({ address }) => address),
    checkedAt,
  };
}
