import { connect, type Socket } from "node:net";
import { acceptDesktopEngineResponse, desktopEngineConnectRequest,
  DESKTOP_ENGINE_PROXY_HOST, DESKTOP_ENGINE_PROXY_PORT,
} from "./release-registry-egress-proxy.policy";
import { readBoundedSocketHeader, wireBidirectionalTunnel,
} from "./release-socket-tunnel";

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
  const containError = () => undefined;
  upstream.on("error", containError);
  upstream.once("close", () => upstream.removeListener("error", containError));
  return establishTunnel(client, upstream, options);
}

async function establishTunnel(client: Socket, upstream: Socket,
  options: DesktopTunnelOptions) {
  upstream.once("connect", () => upstream.write(desktopEngineConnectRequest()));
  try {
    const response = await readBoundedSocketHeader(upstream, {
      maxBytes: options.maxHeaderBytes, timeoutMs: options.timeoutMs,
      abortSocket: client,
    });
    acceptDesktopEngineResponse(response.header);
    wireBidirectionalTunnel(client, upstream, { toLeft: response.remaining.length
      ? Buffer.concat([ESTABLISHED, response.remaining]) : ESTABLISHED });
  } catch (error) {
    upstream.destroy(); throw error;
  }
}
