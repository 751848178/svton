import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  SiteRouteSwitchInput,
  SiteRouteSwitchObservation,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";

const PROVIDER_KEY = "http-route-control-v1";

@Injectable()
export class HttpSiteRouteSwitchProvider {
  readonly identity = { providerKey: PROVIDER_KEY, receiptVersion: 1 } as const;
  private readonly endpoint?: string;
  private readonly token?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.endpoint = normalizedEndpoint(
      config.get<string>("SITE_ROUTE_SWITCH_HTTP_ENDPOINT"),
    );
    this.token = config.get<string>("SITE_ROUTE_SWITCH_HTTP_TOKEN");
    this.timeoutMs =
      config.get<number>("SITE_ROUTE_SWITCH_HTTP_TIMEOUT_MS") ?? 5000;
  }

  assertConfigured() {
    if (!this.endpoint || !this.token || this.token.length < 32) {
      throw new Error("SITE_ROUTE_SWITCH_HTTP_CONFIGURATION_INVALID");
    }
  }

  async switchRoute(
    input: SiteRouteSwitchInput,
  ): Promise<SiteRouteSwitchReceipt> {
    try {
      this.assertConfigured();
      const url = this.routeUrl(input.operationId);
      await this.request(url, { method: "PUT", body: JSON.stringify(input) });
      const readback = await this.request(url, { method: "GET" });
      return switchedReceipt(input.operationId, readback);
    } catch (error) {
      return failedReceipt(input.operationId, failureReason(error));
    }
  }

  private routeUrl(operationId: string) {
    return `${this.endpoint}/v1/routes/${encodeURIComponent(operationId)}`;
  }

  private async request(
    url: string,
    init: { method: "PUT" | "GET"; body?: string },
  ) {
    const response = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new RouteControlError(
        init.method === "PUT"
          ? "route_switch_apply_failed"
          : "route_switch_readback_failed",
      );
    }
    return init.method === "GET" ? response.json() : null;
  }
}

function switchedReceipt(
  operationId: string,
  value: unknown,
): SiteRouteSwitchReceipt {
  const record = objectValue(value);
  const observed = objectValue(record.observed);
  if (!record.observedAt || Object.keys(observed).length === 0) {
    throw new RouteControlError("route_switch_readback_invalid");
  }
  return {
    version: 1,
    providerKey: PROVIDER_KEY,
    operationId,
    status: "switched",
    reasonCode: "site_route_switched",
    observedAt: stringValue(record.observedAt),
    observed: {
      siteId: stringValue(observed.siteId) ?? "",
      deploymentRunId: stringValue(observed.deploymentRunId) ?? "",
      targetRef: stringValue(observed.targetRef) ?? "",
      routeHash: stringValue(observed.routeHash) ?? "",
    } satisfies SiteRouteSwitchObservation,
  };
}

function failedReceipt(
  operationId: string,
  reasonCode: string,
): SiteRouteSwitchReceipt {
  return {
    version: 1,
    providerKey: PROVIDER_KEY,
    operationId,
    status: "failed",
    reasonCode,
    observedAt: null,
    observed: null,
  };
}

function normalizedEndpoint(value?: string) {
  if (!value) return undefined;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) return undefined;
  return value.replace(/\/+$/, "");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

class RouteControlError extends Error {
  constructor(readonly reasonCode: string) {
    super(reasonCode);
  }
}

function failureReason(error: unknown) {
  return error instanceof RouteControlError
    ? error.reasonCode
    : "route_switch_provider_request_failed";
}
