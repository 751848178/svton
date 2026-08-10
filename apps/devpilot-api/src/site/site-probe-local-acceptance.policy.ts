import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isIP } from "node:net";
import type {
  SiteProbeAddress,
  SiteProbeTarget,
} from "./site-probe-target.types";

const PROFILE = "parity-hosts-v1";
const GOAL = "devpilot-v13-opencode-acceptance";
const HOSTNAME = "parity.example.test";

@Injectable()
export class SiteProbeLocalAcceptancePolicy {
  constructor(@Optional() private readonly config?: ConfigService) {}

  finalUrl(
    primaryDomain: string | null,
    tlsRequired?: boolean | null,
  ): string | null {
    const acceptance = this.acceptance();
    if (
      !acceptance ||
      primaryDomain !== acceptance.hostname ||
      tlsRequired !== false
    ) {
      return null;
    }
    return `http://${acceptance.hostname}:${acceptance.port}/`;
  }

  allows(target: SiteProbeTarget, addresses: readonly SiteProbeAddress[]) {
    const acceptance = this.acceptance();
    return Boolean(
      acceptance &&
      target.url === `http://${acceptance.hostname}:${acceptance.port}/` &&
      target.hostname === acceptance.hostname &&
      target.port === acceptance.port &&
      addresses.length > 0 &&
      addresses.every(({ address }) => isLocalAddress(address)),
    );
  }

  private acceptance(): { hostname: string; port: number } | null {
    if (
      this.value("SITE_PROBE_LOCAL_ACCEPTANCE_PROFILE") !== PROFILE ||
      this.value("SITE_PROBE_LOCAL_ACCEPTANCE_HOSTNAME") !== HOSTNAME ||
      this.value("PARITY_GOAL_ID") !== GOAL ||
      this.value("PARITY_REQUIRE_VERIFIED_RUNTIME") !== "1" ||
      !/^c5-[0-9a-f]{8}-[0-9a-f]{32}$/.test(this.value("PARITY_RUNTIME_ID")) ||
      !/^[0-9a-f]{40}$/.test(this.value("PARITY_SOURCE_REVISION"))
    ) {
      return null;
    }
    const port = Number(this.value("SITE_PROBE_LOCAL_ACCEPTANCE_PORT"));
    return Number.isSafeInteger(port) && port >= 1024 && port <= 65535
      ? { hostname: HOSTNAME, port }
      : null;
  }

  private value(key: string): string {
    return this.config?.get<string>(key) ?? "";
  }
}

function isLocalAddress(value: string): boolean {
  const family = isIP(value);
  if (family === 4) {
    const [a, b] = value.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (family !== 6) return false;
  const normalized = value.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}
