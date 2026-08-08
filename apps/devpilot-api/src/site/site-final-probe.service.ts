import { Injectable } from "@nestjs/common";
import { probeFinalDns } from "./site-final-dns-probe";
import { probeFinalHttp } from "./site-final-http-probe";
import { probeFinalTls } from "./site-final-tls-probe";
import { finalSiteUrl } from "./site-final-url";
import { probeError } from "./site-probe-error";
import { SiteProbeResolverService } from "./site-probe-resolver.service";
import type { ApprovedSiteProbeTarget } from "./site-probe-target.types";
import type {
  SiteProbeHttpBlock,
  SiteProbeInput,
  SiteProbePort,
  SiteProbeResult,
  SiteProbeTlsBlock,
} from "./site-route-activation.types";

const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class SiteFinalProbeService implements SiteProbePort {
  constructor(
    private readonly resolver: SiteProbeResolverService = new SiteProbeResolverService(),
  ) {}

  async probe(input: SiteProbeInput): Promise<SiteProbeResult> {
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const finalUrl = finalSiteUrl(input.primaryDomain, input.tlsRequired);
    const resolved = await this.resolve(finalUrl, timeoutMs);
    const dns = probeFinalDns(resolved.target, resolved.error);
    const [tls, http] = resolved.target
      ? await Promise.all([
          probeTlsForFinalTarget(resolved.target, input.tlsRequired, timeoutMs),
          probeFinalHttp(resolved.target, timeoutMs),
        ])
      : [
          unavailableTls(finalUrl, input.tlsRequired, resolved.error),
          unavailableHttp(finalUrl, resolved.error),
        ];
    return {
      version: 1,
      primaryDomain: input.primaryDomain,
      finalUrl,
      probedAt: new Date().toISOString(),
      dns,
      tls,
      http,
    };
  }

  private async resolve(finalUrl: string | null, timeoutMs: number) {
    if (!finalUrl) {
      return {
        target: null,
        error: Object.assign(new Error("no final site URL to probe"), {
          code: "NO_URL",
        }),
      };
    }
    try {
      return { target: await this.resolver.resolve(finalUrl, timeoutMs), error: null };
    } catch (error) {
      return { target: null, error };
    }
  }
}

export function probeTlsForFinalTarget(
  target: ApprovedSiteProbeTarget,
  tlsRequired: boolean | null | undefined,
  timeoutMs: number,
  probe: typeof probeFinalTls = probeFinalTls,
) {
  if (tlsRequired === false) return Promise.resolve(notRequiredTls(target.hostname));
  return probe(target.hostname, timeoutMs, {
    port: target.port,
    pinnedAddress: target.address,
    family: target.family,
  });
}

function notRequiredTls(host: string | null): SiteProbeTlsBlock {
  return {
    status: "not_required",
    host,
    port: null,
    servername: null,
    checkedAt: new Date().toISOString(),
  };
}

function unavailableTls(
  finalUrl: string | null,
  tlsRequired: boolean | null | undefined,
  error: unknown,
): SiteProbeTlsBlock {
  const host = safeHostname(finalUrl);
  if (tlsRequired === false) return notRequiredTls(host);
  return {
    status: "unavailable",
    host,
    port: finalUrl?.startsWith("https:") ? 443 : null,
    servername: host,
    error: probeError(error),
    checkedAt: new Date().toISOString(),
  };
}

function unavailableHttp(finalUrl: string | null, error: unknown): SiteProbeHttpBlock {
  return {
    status: "unavailable",
    url: finalUrl,
    finalUrl,
    error: probeError(error),
    checkedAt: new Date().toISOString(),
  };
}

function safeHostname(value: string | null): string | null {
  try {
    return value ? new URL(value).hostname : null;
  } catch {
    return null;
  }
}
