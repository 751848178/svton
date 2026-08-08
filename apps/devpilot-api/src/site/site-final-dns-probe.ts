import { promises as dns } from "node:dns";
import type { SiteProbeBlock } from "./site-route-activation.types";
import { probeError, withProbeTimeout } from "./site-probe-error";

export async function probeFinalDns(
  hostname: string | null,
  timeoutMs: number,
): Promise<SiteProbeBlock> {
  const checkedAt = new Date().toISOString();
  if (!hostname) {
    return {
      status: "unavailable",
      hostname: null,
      error: { code: "NO_DOMAIN", message: "no route domain to resolve" },
      checkedAt,
    };
  }
  try {
    const records = await withProbeTimeout(
      dns.resolve(hostname),
      timeoutMs,
      "DNS_TIMEOUT",
    );
    return { status: "resolved", hostname, records, checkedAt };
  } catch (error) {
    return {
      status: "unavailable",
      hostname,
      error: probeError(error),
      checkedAt,
    };
  }
}
