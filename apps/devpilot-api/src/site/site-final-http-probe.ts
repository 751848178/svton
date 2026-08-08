import { createHash } from "node:crypto";
import {
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
  type RequestOptions,
} from "node:http";
import { request as httpsRequest } from "node:https";
import type { SiteProbeHttpBlock } from "./site-route-activation.types";
import { createPinnedLookup } from "./site-pinned-lookup";
import { probeError } from "./site-probe-error";
import type { ApprovedSiteProbeTarget } from "./site-probe-target.types";

const MAX_BODY_BYTES = 64 * 1024;

export type SiteProbeHttpTransport = (
  protocol: "http:" | "https:",
  options: SiteProbeRequestOptions,
  onResponse: (response: IncomingMessage) => void,
) => ClientRequest;

export type SiteProbeRequestOptions = RequestOptions & { servername?: string };

const defaultTransport: SiteProbeHttpTransport = (protocol, options, response) =>
  (protocol === "http:" ? httpRequest : httpsRequest)(options, response);

export async function probeFinalHttp(
  target: ApprovedSiteProbeTarget | null,
  timeoutMs: number,
  transport: SiteProbeHttpTransport = defaultTransport,
): Promise<SiteProbeHttpBlock> {
  const checkedAt = new Date().toISOString();
  if (!target) return unavailable(null, { code: "NO_URL", message: "no final site URL to probe" }, checkedAt);
  const attempt = await requestFinalUrl(target, timeoutMs, transport);
  if (attempt.error) return unavailable(target.url, attempt.error, checkedAt);
  const statusCode = attempt.statusCode;
  return {
    status:
      typeof statusCode === "number" && statusCode >= 200 && statusCode < 300
        ? "passed"
        : "failed",
    url: target.url,
    finalUrl: target.url,
    statusCode,
    bodySignature: attempt.bodySignature,
    checkedAt: new Date().toISOString(),
  };
}

function requestFinalUrl(
  target: ApprovedSiteProbeTarget,
  timeoutMs: number,
  transport: SiteProbeHttpTransport,
): Promise<HttpAttempt> {
  return new Promise((resolve) => {
    let settled = false;
    const timer: { value?: NodeJS.Timeout } = {};
    const finish = (attempt: HttpAttempt) => {
      if (settled) return;
      settled = true;
      if (timer.value) clearTimeout(timer.value);
      resolve(attempt);
    };
    const options: SiteProbeRequestOptions = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.path,
      method: "GET",
      headers: { Host: target.hostHeader },
      lookup: createPinnedLookup(target),
      servername: target.hostname,
    };
    const req = transport(target.protocol, options, (res) =>
      consumeResponse(res, finish),
    );
    timer.value = setTimeout(
      () => req.destroy(codedError("HTTP_TIMEOUT", "HTTP probe timed out")),
      timeoutMs,
    );
    req.on("error", (error) => finish(failedAttempt(error)));
    req.end();
  });
}

function consumeResponse(
  response: IncomingMessage,
  finish: (attempt: HttpAttempt) => void,
) {
  const declared = Number(response.headers["content-length"] ?? 0);
  if (declared > MAX_BODY_BYTES) {
    response.destroy(codedError("HTTP_BODY_TOO_LARGE", "HTTP body exceeds probe limit"));
    finish(failedAttempt(codedError("HTTP_BODY_TOO_LARGE", "HTTP body exceeds probe limit")));
    return;
  }
  const signature = createHash("sha256");
  let size = 0;
  response.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      response.destroy(codedError("HTTP_BODY_TOO_LARGE", "HTTP body exceeds probe limit"));
      return;
    }
    signature.update(chunk);
  });
  response.on("end", () =>
    finish({
      statusCode: response.statusCode ?? null,
      bodySignature: size > 0 ? `sha256:${signature.digest("hex")}` : null,
      error: null,
    }),
  );
  response.on("error", (error) => finish(failedAttempt(error)));
}

interface HttpAttempt {
  statusCode: number | null;
  bodySignature: string | null;
  error: { code: string; message: string } | null;
}

function failedAttempt(error: unknown): HttpAttempt {
  return { statusCode: null, bodySignature: null, error: probeError(error) };
}

function unavailable(
  url: string | null,
  error: { code: string; message: string },
  checkedAt: string,
): SiteProbeHttpBlock {
  return { status: "unavailable", url, finalUrl: url, error, checkedAt };
}

function codedError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}
