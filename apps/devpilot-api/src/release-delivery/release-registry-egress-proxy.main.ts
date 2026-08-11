import { lookup } from "node:dns/promises";
import { createServer, connect } from "node:net";
import { authorizeRegistryConnect, RELEASE_REGISTRY_HOST as HOST,
  RELEASE_REGISTRY_PORT as PORT } from "./release-registry-egress-proxy.policy";

const server = createServer((client) => {
  client.once("data", async (request) => {
    try {
      const line = request.toString("ascii", 0, Math.min(request.length, 4096))
        .split("\r\n", 1)[0];
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
  });
});
server.listen(3128, "0.0.0.0");
