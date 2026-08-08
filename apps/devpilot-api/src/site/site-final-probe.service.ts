import { Injectable } from "@nestjs/common";
import type {
  SiteProbeInput,
  SiteProbePort,
  SiteProbeResult,
} from "./site-route-activation.types";
import { probeFinalDns } from "./site-final-dns-probe";
import { probeFinalHttp } from "./site-final-http-probe";
import { probeFinalTls } from "./site-final-tls-probe";
import { finalSiteUrl } from "./site-final-url";

const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class SiteFinalProbeService implements SiteProbePort {
  async probe(input: SiteProbeInput): Promise<SiteProbeResult> {
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const finalUrl = finalSiteUrl(input.primaryDomain, input.tlsRequired);
    const [dnsBlock, tlsBlock, httpBlock] = await Promise.all([
      probeFinalDns(input.primaryDomain, timeoutMs),
      probeTlsForFinalUrl(finalUrl, input.tlsRequired, timeoutMs),
      probeFinalHttp(finalUrl, timeoutMs),
    ]);
    return {
      version: 1,
      primaryDomain: input.primaryDomain,
      finalUrl,
      probedAt: new Date().toISOString(),
      dns: dnsBlock,
      tls: tlsBlock,
      http: httpBlock,
    };
  }
}

export function probeTlsForFinalUrl(
  finalUrl: string | null,
  tlsRequired: boolean | null | undefined,
  timeoutMs: number,
  probe: typeof probeFinalTls = probeFinalTls,
) {
  const checkedAt = new Date().toISOString();
  if (tlsRequired === false) {
    return Promise.resolve({
      status: "not_required",
      host: finalUrl ? new URL(finalUrl).hostname : null,
      port: null,
      servername: null,
      checkedAt,
    });
  }
  if (!finalUrl) return probe(null, timeoutMs);
  const target = new URL(finalUrl);
  return probe(target.hostname, timeoutMs, {
    port: target.port ? Number(target.port) : 443,
  });
}
