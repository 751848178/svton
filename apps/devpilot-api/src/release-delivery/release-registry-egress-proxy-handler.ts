import { lookup } from "node:dns/promises";
import { connect, type Socket } from "node:net";
import { authorizeRegistryConnect, authorizeRegistryRequest,
  registryProxyUsesPublicDns, RELEASE_REGISTRY_HOST as HOST,
  RELEASE_REGISTRY_PORT as PORT,
} from "./release-registry-egress-proxy.policy";
import { tunnelDesktop } from "./release-registry-desktop-tunnel";
import { readBoundedSocketHeader, wireBidirectionalTunnel,
} from "./release-socket-tunnel";

const ESTABLISHED = Buffer.from("HTTP/1.1 200 Connection Established\r\n\r\n");
const FORBIDDEN = Buffer.from("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");

export type RegistryProxyHandlerOptions = {
  mode: string;
  headerTimeoutMs?: number;
  connectTimeoutMs?: number;
  resolveAddresses?: () => Promise<string[]>;
  connectDirect?: (address: string) => Socket;
  connectDesktop?: (client: Socket) => Promise<void>;
};

export async function handleRegistryProxyClient(client: Socket,
  options: RegistryProxyHandlerOptions) {
  const containError = () => undefined;
  client.on("error", containError);
  client.once("close", () => client.removeListener("error", containError));
  try {
    const request = await readBoundedSocketHeader(client, {
      timeoutMs: options.headerTimeoutMs,
    });
    const headers = request.header.toString("ascii");
    const line = headers.split("\r\n", 1)[0];
    if (!registryProxyUsesPublicDns(options.mode)) {
      authorizeRegistryRequest(line, headers);
      await (options.connectDesktop ?? tunnelDesktop)(client);
      return;
    }
    const addresses = await (options.resolveAddresses ?? resolveRegistry)();
    const address = authorizeRegistryConnect({ requestLine: line, headers, addresses });
    await tunnelDirect(client, address, request.remaining, options);
  } catch {
    if (!client.destroyed && client.writable) client.end(FORBIDDEN);
  }
}

async function tunnelDirect(client: Socket, address: string, remaining: Buffer,
  options: RegistryProxyHandlerOptions) {
  const upstream = (options.connectDirect ?? ((host) => connect({ host, port: PORT })))(address);
  const containError = () => undefined;
  upstream.on("error", containError);
  upstream.once("close", () => upstream.removeListener("error", containError));
  try {
    await waitForConnect(upstream, client, options.connectTimeoutMs ?? 5_000);
    wireBidirectionalTunnel(client, upstream, {
      toLeft: ESTABLISHED,
      toRight: remaining,
    });
  } catch (error) {
    upstream.destroy(); throw error;
  }
}

function waitForConnect(socket: Socket, abortSocket: Socket, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("registry connect timeout")), timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener("connect", onConnect);
      socket.removeListener("error", onError);
      socket.removeListener("end", onEnd);
      socket.removeListener("close", onClose);
      abortSocket.removeListener("error", onError);
      abortSocket.removeListener("end", onAbort);
      abortSocket.removeListener("close", onAbort);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve();
    };
    const onConnect = () => finish();
    const onError = (error: Error) => finish(error);
    const onEnd = () => finish(new Error("registry upstream ended"));
    const onClose = () => finish(new Error("registry upstream closed"));
    const onAbort = () => finish(new Error("registry client closed"));
    socket.once("connect", onConnect);
    socket.once("error", onError);
    socket.once("end", onEnd);
    socket.once("close", onClose);
    abortSocket.once("error", onError);
    abortSocket.once("end", onAbort);
    abortSocket.once("close", onAbort);
  });
}

async function resolveRegistry() {
  return (await lookup(HOST, { all: true, verbatim: true })).map((row) => row.address);
}
