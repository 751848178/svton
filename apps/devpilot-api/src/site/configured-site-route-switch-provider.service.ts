import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpSiteRouteSwitchProvider } from "./http-site-route-switch-provider.service";
import {
  SiteRouteSwitchPort,
  UnconfiguredSiteRouteSwitchProvider,
} from "./site-route-switch.port";

@Injectable()
export class ConfiguredSiteRouteSwitchProvider extends SiteRouteSwitchPort {
  private readonly provider: SiteRouteSwitchPort;

  constructor(
    config: ConfigService,
    http: HttpSiteRouteSwitchProvider,
    unconfigured: UnconfiguredSiteRouteSwitchProvider,
  ) {
    super();
    const profile = config.get<string>("SITE_ROUTE_SWITCH_PROVIDER_PROFILE");
    if (profile === http.identity.providerKey) {
      http.assertConfigured();
      this.provider = http;
    } else {
      this.provider = unconfigured;
    }
  }

  get identity() {
    return this.provider.identity;
  }

  get supportsCompensation() {
    return this.provider.supportsCompensation;
  }

  verifyProductionCapability() {
    return this.provider.verifyProductionCapability();
  }

  switchRoute(input: Parameters<SiteRouteSwitchPort["switchRoute"]>[0]) {
    return this.provider.switchRoute(input);
  }

  observeRoute(operationId: string) {
    return this.provider.observeRoute(operationId);
  }

  observeCurrentRoute(
    input: Parameters<SiteRouteSwitchPort["observeCurrentRoute"]>[0],
  ) {
    return this.provider.observeCurrentRoute(input);
  }

  compensateRoute(
    input: Parameters<SiteRouteSwitchPort["compensateRoute"]>[0],
  ) {
    return this.provider.compensateRoute(input);
  }
}
