import { lookup } from "node:dns/promises";
import { createServer, connect } from "node:net";
import { acceptDesktopEngineResponse, authorizeRegistryConnect,
  authorizeRegistryRequest, desktopEngineConnectRequest,
  DESKTOP_ENGINE_PROXY_HOST, DESKTOP_ENGINE_PROXY_PORT,
  registryProxyUsesPublicDns,
  RELEASE_REGISTRY_HOST as HOST, RELEASE_REGISTRY_PORT as PORT,
} from "./release-registry-egress-proxy.policy";

const mode = process.env.DEVPILOT_DEPENDENCY_NETWORK_MODE;
if (!["docker-desktop-engine-proxy-v1", "direct-public-dns-v1"].includes(mode || ""))
  throw new Error("dependency network mode is invalid");

const server = createServer((client) => { void handle(client); });
async function handle(client: import("node:net").Socket) {
    try {
      const request = await readHeader(client);
      const line = request.toString("ascii", 0, Math.min(request.length, 4096))
        .split("\r\n", 1)[0];
      if (!registryProxyUsesPublicDns(mode!)) {
        authorizeRegistryRequest(line, request.toString("ascii"));
        await tunnelDesktop(client); return;
      }
      const rows = await lookup(HOST, { all: true, verbatim: true });
      const address = authorizeRegistryConnect({ requestLine: line,
        headers: request.toString("ascii"), addresses: rows.map((row) => row.address) });
      const upstream = connect({ host: address, port: PORT });
      upstream.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        client.pipe(upstream); upstream.pipe(client);
      });
      upstream.once("error", () => client.destroy());
    } catch { client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); }
}
server.listen(3128, "0.0.0.0");

function readHeader(socket: import("node:net").Socket) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []; let bytes = 0;
    const timer = setTimeout(() => finish(new Error("request timeout")), 5_000);
    const onData = (chunk: Buffer) => {
      bytes += chunk.length; chunks.push(chunk);
      if (bytes > 4096) { finish(new Error("request too large")); return; }
      const value = Buffer.concat(chunks);
      if (value.includes("\r\n\r\n")) finish(undefined, value);
    };
    const finish = (error?: Error, value?: Buffer) => {
      clearTimeout(timer); socket.removeListener("data", onData);
      if (error) reject(error); else resolve(value!);
    };
    socket.on("data", onData);
  });
}

function tunnelDesktop(client: import("node:net").Socket) {
  return new Promise<void>((resolve, reject) => {
    const upstream = connect({ host: DESKTOP_ENGINE_PROXY_HOST,
      port: DESKTOP_ENGINE_PROXY_PORT });
    const chunks: Buffer[] = []; let bytes = 0;
    const timer = setTimeout(() => fail(new Error("desktop proxy timeout")), 5_000);
    const fail = (error: Error) => { clearTimeout(timer); upstream.destroy(); reject(error); };
    upstream.once("error", fail);
    upstream.once("connect", () => upstream.write(desktopEngineConnectRequest()));
    upstream.on("data", (chunk: Buffer) => {
      bytes += chunk.length; chunks.push(chunk);
      if (bytes > 4096) { fail(new Error("desktop proxy header too large")); return; }
      const response = Buffer.concat(chunks);
      if (!response.includes("\r\n\r\n")) return;
      try { acceptDesktopEngineResponse(response); } catch (error) {
        fail(error as Error); return;
      }
      clearTimeout(timer); upstream.removeListener("error", fail);
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      client.pipe(upstream); upstream.pipe(client); resolve();
    });
  });
}
