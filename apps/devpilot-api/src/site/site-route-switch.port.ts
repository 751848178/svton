import { Injectable } from "@nestjs/common";
import type {
  SiteRouteSwitchInput,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";

export abstract class SiteRouteSwitchPort {
  abstract switchRoute(
    input: SiteRouteSwitchInput,
  ): Promise<SiteRouteSwitchReceipt>;
}

@Injectable()
export class UnconfiguredSiteRouteSwitchProvider implements SiteRouteSwitchPort {
  async switchRoute(
    input: SiteRouteSwitchInput,
  ): Promise<SiteRouteSwitchReceipt> {
    return {
      version: 1,
      providerKey: "unconfigured",
      operationId: input.operationId,
      status: "unavailable",
      reasonCode: "route_switch_provider_unconfigured",
      observedAt: null,
      observed: null,
    };
  }
}
