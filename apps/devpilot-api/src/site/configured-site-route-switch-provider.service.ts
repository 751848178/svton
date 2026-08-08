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

  switchRoute(input: Parameters<SiteRouteSwitchPort["switchRoute"]>[0]) {
    return this.provider.switchRoute(input);
  }
}
