import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";
import type { SiteProbeInput } from "./site-route-activation.types";
import {
  probeFinalHttp,
  type SiteProbeHttpTransport,
  type SiteProbeRequestOptions,
} from "./site-final-http-probe";
import type { ApprovedSiteProbeTarget } from "./site-probe-target.types";

describe("final site HTTP proof", () => {
  it("proves proxyTarget is not part of the probe contract", () => {
    type HasProxyTarget = "proxyTarget" extends keyof SiteProbeInput ? true : false;
    const hasProxyTarget: HasProxyTarget = false;
    expect(hasProxyTarget).toBe(false);
  });

  it("uses original Host and a lookup pinned to the approved peer", async () => {
    let captured = {} as SiteProbeRequestOptions;
    const transport = responseTransport(200, "exact-final-body", (options) => {
      captured = options;
    });

    await expect(probeFinalHttp(target(), 100, transport)).resolves.toMatchObject({
      status: "passed",
      statusCode: 200,
      bodySignature:
        "sha256:058659e48a5bcdab8263c697d0f34fc177e53e427124a23219b6e0eac967e069",
    });

    expect(captured).toMatchObject({
      hostname: "release.example.com",
      servername: "release.example.com",
      headers: { Host: "release.example.com:8443" },
    });
    const pinned = jest.fn();
    const lookup = captured.lookup as unknown as (
      host: string,
      options: object,
      callback: typeof pinned,
    ) => void;
    lookup("release.example.com", {}, pinned);
    expect(pinned).toHaveBeenCalledWith(null, "8.8.8.8", 4);
  });

  it.each([302, 404, 500])("rejects HTTP %i without redirect follow", async (status) => {
    const transport = jest.fn(responseTransport(status, "not-success"));
    await expect(probeFinalHttp(target(), 100, transport)).resolves.toMatchObject({
      status: "failed",
      statusCode: status,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("aborts a response that exceeds the body bound", async () => {
    const body = Buffer.alloc(64 * 1024 + 1, "x");
    await expect(
      probeFinalHttp(target(), 100, responseTransport(200, body)),
    ).resolves.toMatchObject({
      status: "unavailable",
      error: { code: "HTTP_BODY_TOO_LARGE" },
    });
  });

  it("fails closed when final URL is missing", async () => {
    await expect(probeFinalHttp(null, 100)).resolves.toMatchObject({
      status: "unavailable",
      url: null,
      finalUrl: null,
      error: { code: "NO_URL" },
    });
  });
});

function target(): ApprovedSiteProbeTarget {
  return {
    url: "https://release.example.com:8443/release",
    protocol: "https:",
    hostname: "release.example.com",
    port: 8443,
    hostHeader: "release.example.com:8443",
    path: "/release",
    address: "8.8.8.8",
    family: 4,
    addresses: [{ address: "8.8.8.8", family: 4 }],
  };
}

function responseTransport(
  statusCode: number,
  body: string | Buffer,
  inspect?: (options: SiteProbeRequestOptions) => void,
): SiteProbeHttpTransport {
  return (_protocol, options, onResponse) => {
    inspect?.(options);
    const request = new EventEmitter() as ClientRequest;
    request.end = () => {
      const stream = new PassThrough();
      const response = stream as unknown as IncomingMessage;
      response.statusCode = statusCode;
      response.headers = {};
      process.nextTick(() => {
        onResponse(response);
        stream.end(body);
      });
      return request;
    };
    request.destroy = (error?: Error) => {
      if (error) process.nextTick(() => request.emit("error", error));
      return request;
    };
    return request;
  };
}
