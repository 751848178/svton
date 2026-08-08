import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { SiteProbeInput } from "./site-route-activation.types";
import { probeFinalHttp } from "./site-final-http-probe";

describe("final site HTTP proof", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  it("proves proxyTarget is not part of the probe contract", () => {
    type HasProxyTarget = "proxyTarget" extends keyof SiteProbeInput
      ? true
      : false;
    const hasProxyTarget: HasProxyTarget = false;
    expect(hasProxyTarget).toBe(false);
  });

  it("passes only the exact final URL 2xx and hashes the complete body", async () => {
    const server = await listen(200, "exact-final-body");
    const finalUrl = serverUrl(server, "/release");

    await expect(probeFinalHttp(finalUrl, 1000)).resolves.toMatchObject({
      status: "passed",
      url: finalUrl,
      finalUrl,
      statusCode: 200,
      bodySignature:
        "sha256:058659e48a5bcdab8263c697d0f34fc177e53e427124a23219b6e0eac967e069",
    });
  });

  it.each([302, 404, 500])("rejects HTTP %i", async (statusCode) => {
    const server = await listen(statusCode, "not-final-success");
    const result = await probeFinalHttp(serverUrl(server), 1000);
    expect(result).toMatchObject({ status: "failed", statusCode });
  });

  it("does not let an unrelated 200 endpoint rescue an unreachable final URL", async () => {
    let unrelatedHits = 0;
    const unrelated = await listen(200, "unrelated", () => unrelatedHits++);
    const unreachable = await closedServerUrl();

    const result = await probeFinalHttp(unreachable, 200);

    expect(result).toMatchObject({
      status: "unavailable",
      url: unreachable,
      finalUrl: unreachable,
    });
    expect(unrelatedHits).toBe(0);
    expect(serverUrl(unrelated)).not.toBe(unreachable);
  });

  it("fails closed when final URL is missing", async () => {
    await expect(probeFinalHttp(null, 100)).resolves.toMatchObject({
      status: "unavailable",
      url: null,
      finalUrl: null,
      error: { code: "NO_URL" },
    });
  });

  function listen(status: number, body: string, onRequest?: () => void) {
    return new Promise<Server>((resolve) => {
      const server = createServer((_request, response) => {
        onRequest?.();
        response.writeHead(status, { "content-type": "text/plain" });
        response.end(body);
      });
      server.listen(0, "127.0.0.1", () => {
        servers.push(server);
        resolve(server);
      });
    });
  }
});

function serverUrl(server: Server, path = "/") {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}${path}`;
}

async function closedServerUrl() {
  const server = await new Promise<Server>((resolve) => {
    const candidate = createServer();
    candidate.listen(0, "127.0.0.1", () => resolve(candidate));
  });
  const url = serverUrl(server);
  await closeServer(server);
  return url;
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
