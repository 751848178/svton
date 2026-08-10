import { connect as tlsConnect } from "node:tls";
import type { ConnectionOptions, PeerCertificate, TLSSocket } from "node:tls";
import type { SiteProbeTlsBlock } from "./site-route-activation.types";
import { createPinnedLookup } from "./site-pinned-lookup";
import { probeError } from "./site-probe-error";

export interface FinalTlsProbeOptions {
  ca?: ConnectionOptions["ca"];
  pinnedAddress: string;
  family: 4 | 6;
  port?: number;
}

export function probeFinalTls(
  hostname: string | null,
  timeoutMs: number,
  options: FinalTlsProbeOptions,
): Promise<SiteProbeTlsBlock> {
  const checkedAt = new Date().toISOString();
  const port = options.port ?? 443;
  if (!hostname) {
    return Promise.resolve({
      status: "unavailable",
      host: null,
      port,
      error: { code: "NO_DOMAIN", message: "no route domain for TLS probe" },
      checkedAt,
    });
  }
  return new Promise((resolve) => {
    const pinned = { address: options.pinnedAddress, family: options.family };
    const socket = tlsConnect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: true,
        ca: options.ca,
        lookup: createPinnedLookup(pinned),
      },
      () => {
        const raw = socket.getPeerCertificate();
        const authorized = socket.authorized;
        resolve({
          status: authorized ? "valid" : "invalid",
          host: hostname,
          port,
          servername: hostname,
          peerAddress: socket.remoteAddress ?? null,
          authorized,
          authorizationErrorCode: authorizationErrorCode(socket),
          cert: certificateEvidence(raw),
          checkedAt: new Date().toISOString(),
        });
        socket.end();
      },
    );
    socket.on("error", (error) => {
      const networkFailure = isNetworkFailure(error);
      const authorizationCode = networkFailure
        ? null
        : errorCode(error) ?? authorizationErrorCode(socket);
      const raw = certificateFromError(error) ?? peerCertificate(socket);
      resolve({
        status: networkFailure ? "unavailable" : "invalid",
        host: hostname,
        port,
        servername: hostname,
        peerAddress: socket.remoteAddress ?? null,
        authorized: socket.authorized,
        authorizationErrorCode: authorizationCode,
        cert:
          certificateEvidence(raw) ??
          certificateErrorEvidence(authorizationCode),
        error: probeError(error),
        checkedAt: new Date().toISOString(),
      });
    });
    socket.setTimeout(timeoutMs, () => {
      socket.destroy(
        Object.assign(new Error("TLS probe timed out"), { code: "TLS_TIMEOUT" }),
      );
    });
  });
}

const NETWORK_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "TLS_TIMEOUT",
]);

function isNetworkFailure(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && NETWORK_ERROR_CODES.has(code);
}

function errorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

function authorizationErrorCode(socket: TLSSocket): string | null {
  const error = socket.authorizationError;
  if (!error) return null;
  if (typeof error === "string") return error;
  return errorCode(error) ?? error.message ?? "TLS_UNAUTHORIZED";
}

function certificateFromError(error: unknown): PeerCertificate | null {
  const certificate = (error as { cert?: unknown } | null)?.cert;
  return certificate && typeof certificate === "object"
    ? (certificate as PeerCertificate)
    : null;
}

function peerCertificate(socket: TLSSocket): PeerCertificate | null {
  try {
    const certificate = socket.getPeerCertificate();
    return Object.keys(certificate).length > 0 ? certificate : null;
  } catch {
    return null;
  }
}

function certificateEvidence(
  certificate: PeerCertificate | null | undefined,
): SiteProbeTlsBlock["cert"] {
  if (!certificate || Object.keys(certificate).length === 0) return null;
  return {
    subject: formatName(certificate.subject),
    issuer: formatName(certificate.issuer),
    validFrom: certificate.valid_from ? toIso(certificate.valid_from) : null,
    validUntil: certificate.valid_to ? toIso(certificate.valid_to) : null,
    expired: isCertExpired(certificate.valid_to),
    fingerprint256: certificate.fingerprint256 ?? null,
  };
}

function certificateErrorEvidence(
  authorizationCode: string | null,
): SiteProbeTlsBlock["cert"] {
  return authorizationCode === "CERT_HAS_EXPIRED" ? { expired: true } : null;
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
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}
