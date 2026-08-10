import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  SiteRouteCompensationInput,
  SiteRouteCurrentObservationInput,
  SiteRouteCurrentReceipt,
  SiteRouteSwitchInput,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";
import {
  assertProductionCapability,
  currentReceipt,
  failedReceipt,
  failureReason,
  HTTP_ROUTE_PROVIDER_KEY,
  RouteControlError,
  switchedReceipt,
} from "./http-site-route-switch-protocol";

@Injectable()
export class HttpSiteRouteSwitchProvider {
  readonly identity = {
    providerKey: HTTP_ROUTE_PROVIDER_KEY,
    receiptVersion: 1,
  } as const;
  private capabilityVerified = false;
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

  get supportsCompensation() {
    return this.capabilityVerified;
  }

  async verifyProductionCapability() {
    if (this.capabilityVerified) return;
    this.assertConfigured();
    const value = await this.request(`${this.endpoint}/v1/capabilities`, {
      method: "GET",
    });
    assertProductionCapability(value);
    this.capabilityVerified = true;
  }

  async switchRoute(
    input: SiteRouteSwitchInput,
  ): Promise<SiteRouteSwitchReceipt> {
    try {
      await this.verifyProductionCapability();
      const url = this.routeUrl(input.operationId);
      await this.request(url, { method: "PUT", body: JSON.stringify(input) });
      const readback = await this.request(url, { method: "GET" });
      return switchedReceipt(input.operationId, readback);
    } catch (error) {
      return failedReceipt(input.operationId, failureReason(error));
    }
  }

  async observeRoute(operationId: string): Promise<SiteRouteSwitchReceipt> {
    try {
      await this.verifyProductionCapability();
      return switchedReceipt(
        operationId,
        await this.request(this.routeUrl(operationId), { method: "GET" }),
      );
    } catch (error) {
      return failedReceipt(operationId, failureReason(error));
    }
  }

  async observeCurrentRoute(
    input: SiteRouteCurrentObservationInput,
  ): Promise<SiteRouteCurrentReceipt> {
    try {
      await this.verifyProductionCapability();
      const query = new URLSearchParams(Object.entries(input)).toString();
      return currentReceipt(
        await this.request(`${this.endpoint}/v1/routes/current?${query}`, {
          method: "GET",
        }),
      );
    } catch (error) {
      return {
        version: 1,
        providerKey: this.identity.providerKey,
        status: "failed",
        reasonCode: failureReason(error),
        observedAt: null,
        observed: null,
        route: null,
      };
    }
  }

  async compensateRoute(
    input: SiteRouteCompensationInput,
  ): Promise<SiteRouteSwitchReceipt> {
    try {
      await this.verifyProductionCapability();
      const url = this.routeUrl(input.operationId);
      await this.request(url, {
        method: "PUT",
        body: JSON.stringify({
          ...input,
          action: input.desiredRoute ? "restore" : "clear",
        }),
      });
      const readback = await this.request(url, { method: "GET" });
      return switchedReceipt(input.operationId, readback, !input.desiredRoute);
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
      if (response.status === 409) {
        throw new RouteControlError("route_switch_cas_conflict");
      }
      throw new RouteControlError(
        init.method === "PUT"
          ? "route_switch_apply_failed"
          : "route_switch_readback_failed",
      );
    }
    return init.method === "GET" ? response.json() : null;
  }
}

function normalizedEndpoint(value?: string) {
  if (!value) return undefined;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) return undefined;
  return value.replace(/\/+$/, "");
}
