import { connect as tlsConnect } from "node:tls";
import type { SiteProbeTlsBlock } from "./site-route-activation.types";
import { probeError } from "./site-probe-error";

export function probeFinalTls(
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
        resolve({
          status: expired ? "invalid" : "valid",
          host: hostname,
          port: 443,
          servername: hostname,
          cert: {
            subject: formatName(raw?.subject),
            issuer: formatName(raw?.issuer),
            validFrom: raw?.valid_from ? toIso(raw.valid_from) : null,
            validUntil: raw?.valid_to ? toIso(raw.valid_to) : null,
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
