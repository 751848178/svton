import type { SiteProbeResult } from "../site/site-route-activation.types";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

export function promotionProbeHash(probe: SiteProbeResult) {
  return hashCanonicalReleaseValue({ version: 1, probe });
}

export function parsePromotionObservation(value: unknown): SiteProbeResult | null {
  const row = record(value);
  const dns = record(row?.dns);
  const tls = record(row?.tls);
  const http = record(row?.http);
  const probedAt = date(row?.probedAt);
  return row?.version === 1 && probedAt &&
    typeof dns?.status === "string" && date(dns.checkedAt) &&
    typeof tls?.status === "string" && date(tls.checkedAt) &&
    typeof http?.status === "string" && date(http.checkedAt) &&
    (http.statusCode == null || finite(http.statusCode)) &&
    (http.finalUrl == null || typeof http.finalUrl === "string")
    ? row as unknown as SiteProbeResult
    : null;
}

export function isStablePromotionObservation(probe: SiteProbeResult) {
  const statusCode = probe.http.statusCode;
  return probe.http.status === "passed" &&
    typeof statusCode === "number" && statusCode >= 200 && statusCode < 300 &&
    probe.dns.status === "resolved" &&
    (String(probe.http.finalUrl ?? "").startsWith("http://") ||
      probe.tls.status === "valid");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function date(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}
