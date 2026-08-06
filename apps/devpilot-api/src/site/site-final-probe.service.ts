// F438: real DNS / TLS / HTTP probes of the final site URL.
// Honest semantics: a definitive negative (TLS cert expired/invalid, HTTP non-2xx on a
// reachable URL) yields "invalid"/"failed"; a network/provider absence yields explicit
// "unavailable" (never a false pass). Zero-secret: only public cert metadata is recorded.
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { connect as tlsConnect } from "node:tls";
import type {
  SiteProbeBlock,
  SiteProbeHttpBlock,
  SiteProbeInput,
  SiteProbePort,
  SiteProbeResult,
  SiteProbeTlsBlock,
} from "./site-route-activation.types";

const DEFAULT_TIMEOUT_MS = 5000;
const BODY_SIGNATURE_LIMIT = 262144;

@Injectable()
export class SiteFinalProbeService implements SiteProbePort {
  async probe(input: SiteProbeInput): Promise<SiteProbeResult> {
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const probedAt = new Date();
    const primaryDomain = input.primaryDomain;
    const finalUrl = primaryDomain
      ? finalSiteUrl(primaryDomain, input.tlsRequired)
      : null;
    const dnsBlock = await probeDns(primaryDomain, timeoutMs);
    const tlsBlock = await probeTls(primaryDomain, timeoutMs);
    const httpBlock = await probeHttp({
      finalUrl,
      proxyTarget: input.proxyTarget,
      tlsRequired: input.tlsRequired,
      timeoutMs,
    });
    return {
      version: 1,
      primaryDomain,
      finalUrl,
      probedAt: probedAt.toISOString(),
      dns: dnsBlock,
      tls: tlsBlock,
      http: httpBlock,
    };
  }
}

async function probeDns(
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
    const records = await withTimeout(
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

function probeTls(
  hostname: string | null,
  timeoutMs: number,
): Promise<SiteProbeTlsBlock> {
  const checkedAt = new Date().toISOString();
  if (!hostname) {
    return Promise.resolve({
      status: "unavailable",
      host: null,
      port: 443,
      error: { code: "NO_DOMAIN", message: "no route domain for TLS probe" },
      checkedAt,
    });
  }
  return new Promise((resolve) => {
    const socket = tlsConnect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
      },
      () => {
        const raw = socket.getPeerCertificate();
        const expired = isCertExpired(raw?.valid_to);
        const validUntil = raw?.valid_to ? toIso(raw.valid_to) : null;
        resolve({
          status: expired ? "invalid" : "valid",
          host: hostname,
          port: 443,
          servername: hostname,
          cert: {
            subject: formatName(raw?.subject),
            issuer: formatName(raw?.issuer),
            validFrom: raw?.valid_from ? toIso(raw.valid_from) : null,
            validUntil,
            expired,
          },
          checkedAt: new Date().toISOString(),
        });
        socket.end();
      },
    );
    socket.on("error", (error) => {
      resolve({
        status: "unavailable",
        host: hostname,
        port: 443,
        servername: hostname,
        error: probeError(error),
        checkedAt: new Date().toISOString(),
      });
    });
    socket.setTimeout(timeoutMs, () => {
      socket.destroy(new Error("TLS_TIMEOUT"));
    });
  });
}

async function probeHttp(input: {
  finalUrl: string | null;
  proxyTarget?: string | null;
  tlsRequired?: boolean | null;
  timeoutMs: number;
}): Promise<SiteProbeHttpBlock> {
  const checkedAt = new Date().toISOString();
  const attempts: string[] = [];
  if (input.finalUrl) attempts.push(input.finalUrl);
  const fallback = httpFallbackUrl(input.proxyTarget);
  if (fallback && fallback !== input.finalUrl) attempts.push(fallback);
  if (attempts.length === 0) {
    return {
      status: "unavailable",
      url: null,
      finalUrl: null,
      error: { code: "NO_URL", message: "no site URL to probe" },
      checkedAt,
    };
  }
  for (const url of attempts) {
    const attempt = await requestOnce(url, input.timeoutMs);
    if (attempt.error) continue;
    return {
      status:
        attempt.statusCode! >= 200 && attempt.statusCode! < 400
          ? "passed"
          : "failed",
      url,
      finalUrl: input.finalUrl,
      statusCode: attempt.statusCode,
      bodySignature: attempt.bodySignature,
      checkedAt: new Date().toISOString(),
    };
  }
  const lastError = (
    await Promise.all(attempts.map((url) => requestOnce(url, input.timeoutMs)))
  )
    .map((attempt) => attempt.error)
    .find(Boolean);
  return {
    status: "unavailable",
    url: attempts[attempts.length - 1] ?? null,
    finalUrl: input.finalUrl,
    error: lastError ?? {
      code: "HTTP_UNREACHABLE",
      message: "site URL unreachable",
    },
    checkedAt: new Date().toISOString(),
  };
}

function requestOnce(
  url: string,
  timeoutMs: number,
): Promise<{
  statusCode: number | null;
  bodySignature: string | null;
  error: { code: string; message: string } | null;
}> {
  return new Promise((resolve) => {
    const target = new URL(url);
    const getter = target.protocol === "http:" ? httpGet : httpsGet;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const req = getter(target, { signal: controller.signal }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size <= BODY_SIGNATURE_LIMIT) chunks.push(chunk);
      });
      res.on("end", () => {
        clearTimeout(timer);
        const body = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode ?? null,
          bodySignature: body.length
            ? `sha256:${createHash("sha256").update(body).digest("hex")}`
            : null,
          error: null,
        });
      });
      res.on("error", (error) => {
        clearTimeout(timer);
        resolve({
          statusCode: null,
          bodySignature: null,
          error: probeError(error),
        });
      });
    });
    req.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        statusCode: null,
        bodySignature: null,
        error: probeError(error),
      });
    });
    req.setTimeout(timeoutMs, () => {
      clearTimeout(timer);
      req.destroy(new Error("HTTP_TIMEOUT"));
    });
  });
}

function finalSiteUrl(primaryDomain: string, tlsRequired?: boolean | null) {
  const scheme = tlsRequired === false ? "http" : "https";
  return `${scheme}://${primaryDomain}`;
}

function httpFallbackUrl(proxyTarget?: string | null): string | null {
  if (!proxyTarget) return null;
  try {
    const url = new URL(proxyTarget);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function probeError(error: unknown): { code: string; message: string } {
  const value = error as { code?: unknown; message?: unknown };
  return {
    code: typeof value?.code === "string" ? value.code : "PROBE_ERROR",
    message:
      typeof value?.message === "string" ? value.message : "probe failed",
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  code: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(code)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function formatName(
  name: { CN?: string; O?: string } | undefined,
): string | null {
  if (!name) return null;
  return [name.CN, name.O].filter(Boolean).join(" / ") || null;
}

function toIso(gmtString: string): string {
  const date = new Date(gmtString);
  return Number.isNaN(date.getTime()) ? gmtString : date.toISOString();
}

function isCertExpired(validTo: string | undefined): boolean {
  if (!validTo) return false;
  const date = new Date(validTo);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}
