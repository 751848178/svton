import { isIP } from "node:net";
import type { SiteProbeTarget } from "./site-probe-target.types";

const DEFAULT_PORT = { "http:": 80, "https:": 443 } as const;

export function parseSiteProbeTarget(value: string): SiteProbeTarget {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw targetError("SITE_PROBE_URL_INVALID", "site probe URL is invalid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw targetError(
      "SITE_PROBE_PROTOCOL_FORBIDDEN",
      "site probe URL must use HTTP or HTTPS",
    );
  }
  if (url.username || url.password) {
    throw targetError(
      "SITE_PROBE_CREDENTIALS_FORBIDDEN",
      "site probe URL must not contain credentials",
    );
  }
  if (url.hash) {
    throw targetError(
      "SITE_PROBE_FRAGMENT_FORBIDDEN",
      "site probe URL must not contain a fragment",
    );
  }
  if (value !== url.toString() || url.hostname.endsWith(".")) {
    throw targetError(
      "SITE_PROBE_URL_NONCANONICAL",
      "site probe URL must be canonical",
    );
  }
  const port = url.port ? Number(url.port) : DEFAULT_PORT[url.protocol];
  if (!isAllowedPort(port, DEFAULT_PORT[url.protocol])) {
    throw targetError(
      "SITE_PROBE_PORT_FORBIDDEN",
      "site probe URL uses a forbidden port",
    );
  }
  return {
    url: url.toString(),
    protocol: url.protocol,
    hostname: unbracket(url.hostname),
    port,
    hostHeader: url.host,
    path: `${url.pathname}${url.search}`,
  };
}

export function isPublicSiteProbeAddress(address: string): boolean {
  const family = isIP(unbracket(address));
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export function targetError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function isAllowedPort(port: number, defaultPort: number): boolean {
  return (
    Number.isSafeInteger(port) &&
    port > 0 &&
    port <= 65535 &&
    (port === defaultPort || port >= 1024)
  );
}

function isPublicIpv4(address: string): boolean {
  const parts = unbracket(address).split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) {
    return false;
  }
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return a < 224;
}

function isPublicIpv6(address: string): boolean {
  const words = ipv6Words(unbracket(address));
  if (!words) return false;
  const mapped = mappedIpv4(words);
  if (mapped) return isPublicIpv4(mapped);
  if (words[0] < 0x2000 || words[0] > 0x3fff) return false;
  if (words[0] === 0x2001 && words[1] === 0x0000) return false;
  if (words[0] === 0x2001 && words[1] === 0x0002) return false;
  if (words[0] === 0x2001 && words[1] === 0x0db8) return false;
  if (
    words[0] === 0x2001 &&
    ((words[1] & 0xfff0) === 0x0010 || (words[1] & 0xfff0) === 0x0020)
  ) {
    return false;
  }
  if (words[0] === 0x2002) return false;
  return !(words[0] === 0x3fff && (words[1] & 0xf000) === 0);
}

function ipv6Words(address: string): number[] | null {
  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) return null;
  const left = ipv6Part(halves[0]);
  const right = halves.length === 2 ? ipv6Part(halves[1]) : [];
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  return [...left, ...Array(missing).fill(0), ...right];
}

function ipv6Part(part: string): number[] | null {
  if (!part) return [];
  const tokens = part.split(":");
  const words: number[] = [];
  for (const token of tokens) {
    if (token.includes(".")) {
      const bytes = token.split(".").map(Number);
      if (bytes.length !== 4 || bytes.some((byte) => byte < 0 || byte > 255)) {
        return null;
      }
      words.push(bytes[0] * 256 + bytes[1], bytes[2] * 256 + bytes[3]);
    } else if (!/^[0-9a-f]{1,4}$/.test(token)) {
      return null;
    } else {
      words.push(Number.parseInt(token, 16));
    }
  }
  return words;
}

function mappedIpv4(words: number[]): string | null {
  if (!words.slice(0, 5).every((word) => word === 0) || words[5] !== 0xffff) {
    return null;
  }
  return [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join(
    ".",
  );
}

function unbracket(value: string): string {
  return value.startsWith("[") && value.endsWith("]")
    ? value.slice(1, -1)
    : value;
}
