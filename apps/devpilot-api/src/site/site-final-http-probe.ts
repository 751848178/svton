import { createHash } from "node:crypto";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import type { SiteProbeHttpBlock } from "./site-route-activation.types";
import { probeError } from "./site-probe-error";

export async function probeFinalHttp(
  finalUrl: string | null,
  timeoutMs: number,
): Promise<SiteProbeHttpBlock> {
  const checkedAt = new Date().toISOString();
  if (!finalUrl) {
    return {
      status: "unavailable",
      url: null,
      finalUrl: null,
      error: { code: "NO_URL", message: "no final site URL to probe" },
      checkedAt,
    };
  }
  const attempt = await requestFinalUrl(finalUrl, timeoutMs);
  if (attempt.error) {
    return {
      status: "unavailable",
      url: finalUrl,
      finalUrl,
      error: attempt.error,
      checkedAt: new Date().toISOString(),
    };
  }
  const statusCode = attempt.statusCode;
  return {
    status:
      typeof statusCode === "number" && statusCode >= 200 && statusCode < 300
        ? "passed"
        : "failed",
    url: finalUrl,
    finalUrl,
    statusCode,
    bodySignature: attempt.bodySignature,
    checkedAt: new Date().toISOString(),
  };
}

function requestFinalUrl(
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
      const signature = createHash("sha256");
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        signature.update(chunk);
      });
      res.on("end", () => {
        clearTimeout(timer);
        resolve({
          statusCode: res.statusCode ?? null,
          bodySignature: size > 0 ? `sha256:${signature.digest("hex")}` : null,
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
