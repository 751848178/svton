import { Injectable } from "@nestjs/common";
import type {
  SiteRouteSwitchInput,
  SiteRouteSwitchProviderIdentity,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";

export abstract class SiteRouteSwitchPort {
  abstract readonly identity: SiteRouteSwitchProviderIdentity;

  abstract switchRoute(
    input: SiteRouteSwitchInput,
  ): Promise<SiteRouteSwitchReceipt>;
}

@Injectable()
export class UnconfiguredSiteRouteSwitchProvider implements SiteRouteSwitchPort {
  readonly identity = {
    providerKey: "unconfigured",
    receiptVersion: 1,
  } as const;

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
}
