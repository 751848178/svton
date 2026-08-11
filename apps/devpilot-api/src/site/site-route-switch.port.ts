import { Injectable } from "@nestjs/common";
import type {
  SiteRouteSwitchInput,
  SiteRouteCompensationInput,
  SiteRouteCurrentObservationInput,
  SiteRouteCurrentReceipt,
  SiteRouteSwitchProviderIdentity,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";

export abstract class SiteRouteSwitchPort {
  abstract readonly identity: SiteRouteSwitchProviderIdentity;
  abstract readonly supportsCompensation: boolean;

  abstract verifyProductionCapability(): Promise<void>;

  abstract switchRoute(
    input: SiteRouteSwitchInput,
  ): Promise<SiteRouteSwitchReceipt>;

  abstract observeRoute(operationId: string): Promise<SiteRouteSwitchReceipt>;

  abstract observeCurrentRoute(
    input: SiteRouteCurrentObservationInput,
  ): Promise<SiteRouteCurrentReceipt>;

  abstract compensateRoute(
    input: SiteRouteCompensationInput,
  ): Promise<SiteRouteSwitchReceipt>;
}

@Injectable()
export class UnconfiguredSiteRouteSwitchProvider implements SiteRouteSwitchPort {
  readonly identity = {
    providerKey: "unconfigured",
    receiptVersion: 1,
  } as const;
  readonly supportsCompensation = false;

  async verifyProductionCapability() {
    throw new Error("SITE_ROUTE_SWITCH_COMPENSATION_UNAVAILABLE");
  }

  async switchRoute(
    input: SiteRouteSwitchInput,
  ): Promise<SiteRouteSwitchReceipt> {
    return {
      version: this.identity.receiptVersion,
      providerKey: this.identity.providerKey,
      operationId: input.operationId,
      status: "unavailable",
      reasonCode: "route_switch_provider_unconfigured",
      observedAt: null,
      observed: null,
    };
  }

  observeRoute(operationId: string) {
    return Promise.resolve(unavailableReceipt(this.identity, operationId));
  }

  compensateRoute(input: SiteRouteCompensationInput) {
    return Promise.resolve(
      unavailableReceipt(this.identity, input.operationId),
    );
  }

  observeCurrentRoute(): Promise<SiteRouteCurrentReceipt> {
    return Promise.resolve({
      version: 1,
      providerKey: this.identity.providerKey,
      status: "unavailable",
      reasonCode: "route_switch_provider_unconfigured",
      observedAt: null,
      observed: null,
      route: null,
    });
  }
}

function unavailableReceipt(
  identity: SiteRouteSwitchProviderIdentity,
  operationId: string,
): SiteRouteSwitchReceipt {
  return {
    version: identity.receiptVersion,
    providerKey: identity.providerKey,
    operationId,
    status: "unavailable",
    reasonCode: "route_switch_provider_unconfigured",
    observedAt: null,
    observed: null,
  };
}
