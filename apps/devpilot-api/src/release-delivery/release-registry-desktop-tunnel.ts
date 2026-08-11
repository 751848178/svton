import { connect, type Socket } from "node:net";
import { acceptDesktopEngineResponse, desktopEngineConnectRequest,
  DESKTOP_ENGINE_PROXY_HOST, DESKTOP_ENGINE_PROXY_PORT,
} from "./release-registry-egress-proxy.policy";

const ESTABLISHED = Buffer.from("HTTP/1.1 200 Connection Established\r\n\r\n");

export type DesktopTunnelOptions = {
  host?: string;
  port?: number;
  timeoutMs?: number;
  maxHeaderBytes?: number;
};

export function tunnelDesktop(client: Socket, options: DesktopTunnelOptions = {}) {
  const upstream = connect({
    host: options.host ?? DESKTOP_ENGINE_PROXY_HOST,
    port: options.port ?? DESKTOP_ENGINE_PROXY_PORT,
  });
  return establishTunnel(client, upstream, options);
}

function establishTunnel(client: Socket, upstream: Socket,
  options: DesktopTunnelOptions) {
  return new Promise<void>((resolve, reject) => {
    const limit = options.maxHeaderBytes ?? 4096;
    let response = Buffer.alloc(0);
    let settled = false;
    const timer = setTimeout(() => fail(new Error("desktop proxy timeout")),
      options.timeoutMs ?? 5_000);
    const cleanupHandshake = () => {
      clearTimeout(timer);
      upstream.removeListener("data", onData);
      upstream.removeListener("end", onUpstreamEnd);
      upstream.removeListener("error", onUpstreamError);
      client.removeListener("error", onClientError);
      client.removeListener("close", onClientClose);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanupHandshake();
      upstream.destroy();
      reject(error);
    };
    const onUpstreamError = (error: Error) => fail(error);
    const onClientError = (error: Error) => fail(error);
    const onUpstreamEnd = () => fail(new Error("desktop proxy closed"));
    const onClientClose = () => fail(new Error("registry client closed"));
    const onData = (chunk: Buffer) => {
      response = Buffer.concat([response, chunk]);
      const boundary = response.indexOf("\r\n\r\n");
      if (boundary < 0) {
        if (response.length > limit)
          fail(new Error("desktop proxy header too large"));
        return;
      }
      const headerEnd = boundary + 4;
      if (headerEnd > limit) {
        fail(new Error("desktop proxy header too large")); return;
      }
      try { acceptDesktopEngineResponse(response.subarray(0, headerEnd)); }
      catch (error) { fail(error as Error); return; }
      settled = true;
      const remaining = response.subarray(headerEnd);
      wireTunnel(client, upstream);
      cleanupHandshake();
      client.write(remaining.length ? Buffer.concat([ESTABLISHED, remaining]) : ESTABLISHED);
      client.pipe(upstream, { end: false });
      upstream.pipe(client, { end: false });
      resolve();
    };
    upstream.once("error", onUpstreamError);
    upstream.once("end", onUpstreamEnd);
    client.once("error", onClientError);
    client.once("close", onClientClose);
    upstream.on("data", onData);
    upstream.once("connect", () => upstream.write(desktopEngineConnectRequest()));
  });
}

function wireTunnel(client: Socket, upstream: Socket) {
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
  client.on("end", () => upstream.end());
  upstream.on("end", () => client.end());
  client.on("close", () => { if (!upstream.destroyed) upstream.destroy(); });
  upstream.on("close", () => { if (!client.destroyed) client.destroy(); });
}
