import { isIP } from "node:net";

export const RELEASE_REGISTRY_HOST = "registry.npmjs.org";
export const RELEASE_REGISTRY_PORT = 443;

export function authorizeRegistryConnect(input: {
  requestLine: string; headers: string; addresses: string[];
}) {
  if (input.requestLine !==
      `CONNECT ${RELEASE_REGISTRY_HOST}:${RELEASE_REGISTRY_PORT} HTTP/1.1` ||
    /proxy-authorization\s*:/i.test(input.headers) || !input.addresses.length ||
    input.addresses.some(privateAddress)) throw new Error("registry_egress_blocked");
  return input.addresses[0];
}

export function privateAddress(value: string) {
  if (!isIP(value)) return true;
  if (value.includes(":")) {
    const normalized = value.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || /^fe[89ab]/.test(normalized);
  }
  const [a, b] = value.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}
