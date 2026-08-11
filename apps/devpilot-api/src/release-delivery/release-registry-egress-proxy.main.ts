import { createServer } from "node:net";
import { handleRegistryProxyClient } from "./release-registry-egress-proxy-handler";

const mode = process.env.DEVPILOT_DEPENDENCY_NETWORK_MODE;
if (!["docker-desktop-engine-proxy-v1", "direct-public-dns-v1"].includes(mode || ""))
  throw new Error("dependency network mode is invalid");

const server = createServer((client) => {
  void handleRegistryProxyClient(client, { mode: mode! });
});
server.listen(3128, "0.0.0.0");
