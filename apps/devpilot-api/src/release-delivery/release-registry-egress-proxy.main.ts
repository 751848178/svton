import { lookup } from "node:dns/promises";
import { createServer, connect } from "node:net";
import { authorizeRegistryConnect,
  authorizeRegistryRequest,
  registryProxyUsesPublicDns,
  RELEASE_REGISTRY_HOST as HOST, RELEASE_REGISTRY_PORT as PORT,
} from "./release-registry-egress-proxy.policy";
import { tunnelDesktop } from "./release-registry-desktop-tunnel";

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
