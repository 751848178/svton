import { isIP } from "node:net";

export const RELEASE_REGISTRY_HOST = "registry.npmjs.org";
export const RELEASE_REGISTRY_PORT = 443;
export const DESKTOP_ENGINE_PROXY_HOST = "http.docker.internal";
export const DESKTOP_ENGINE_PROXY_PORT = 3128;

export function registryProxyUsesPublicDns(mode: string) {
  if (mode === "direct-public-dns-v1") return true;
  if (mode === "docker-desktop-engine-proxy-v1") return false;
  throw new Error("registry_egress_blocked");
}

export function authorizeRegistryRequest(requestLine: string, headers: string) {
  if (requestLine !==
      `CONNECT ${RELEASE_REGISTRY_HOST}:${RELEASE_REGISTRY_PORT} HTTP/1.1` ||
    headers.length > 4096 || /proxy-authorization\s*:/i.test(headers))
    throw new Error("registry_egress_blocked");
}

export function desktopEngineConnectRequest() {
  return `CONNECT ${RELEASE_REGISTRY_HOST}:${RELEASE_REGISTRY_PORT} HTTP/1.1\r\n`+
    `Host: ${RELEASE_REGISTRY_HOST}:${RELEASE_REGISTRY_PORT}\r\n`+
    "Connection: keep-alive\r\n\r\n";
}

export function acceptDesktopEngineResponse(value: Buffer) {
  if (value.length > 4096 || !value.includes("\r\n\r\n") ||
    !/^HTTP\/1\.[01] 200(?: |\r\n)/.test(value.toString("ascii")))
    throw new Error("registry_egress_blocked");
}

export function authorizeRegistryConnect(input: {
  requestLine: string; headers: string; addresses: string[];
}) {
  authorizeRegistryRequest(input.requestLine, input.headers);
  if (!input.addresses.length ||
    input.addresses.some(specialUseAddress)) throw new Error("registry_egress_blocked");
  return input.addresses[0];
}

export function specialUseAddress(value: string) {
  const kind = isIP(value);
  if (kind === 4) return specialIpv4(value);
  if (kind !== 6) return true;
  const words = ipv6Words(value);
  if (!words) return true;
  const [first, second] = words;
  if ((first & 0xe000) !== 0x2000) return true;
  return (first === 0x2001 && second <= 0x01ff) ||
    (first === 0x2001 && (second & 0xfff0) === 0x0020) ||
    (first === 0x2001 && (second & 0xfff0) === 0x0030) ||
    (first === 0x2001 && second === 0x0db8) || first === 0x2002 ||
    (first === 0x3fff && (second & 0xf000) === 0);
}

function specialIpv4(value: string) {
  const octets = value.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => part < 0 || part > 255)) return true;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) || (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 31 && c === 196) ||
    (a === 192 && b === 52 && c === 193) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 175 && c === 48) ||
    (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
    (a === 203 && b === 0 && c === 113);
}

function ipv6Words(value: string) {
  if (value.includes(".")) return null;
  const halves = value.toLowerCase().split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const words = [...left, ...Array(missing).fill("0"), ...right];
  if (words.length !== 8 || words.some((word) => !/^[a-f0-9]{1,4}$/.test(word)))
    return null;
  return words.map((word) => Number.parseInt(word, 16));
}
