import { SiteFinalProbeService } from "../site/site-final-probe.service";
import { SiteProbeResolverService } from "../site/site-probe-resolver.service";
import { SiteRouteActivationService } from "../site/site-route-activation.service";
import { SiteProbePort, SiteRouteActivationPort } from "../site/site-route-activation.types";
import { SiteRouteSwitchEvidenceRepository } from "../site/site-route-switch-evidence.repository";
import { SiteRouteSwitchPort, UnconfiguredSiteRouteSwitchProvider } from "../site/site-route-switch.port";
import { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionRecoveryRepository } from "./environment-version-recovery.repository";
import { EnvironmentVersionRecoveryService } from "./environment-version-recovery.service";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { EnvironmentVersionService } from "./environment-version.service";

export const releaseDeliveryEnvironmentProviders = [
  EnvironmentVersionRepository,
  EnvironmentVersionCompletionRepository,
  EnvironmentVersionService,
  EnvironmentVersionReadRepository,
  EnvironmentVersionPolicyService,
  EnvironmentVersionRecoveryRepository,
  EnvironmentVersionRecoveryService,
  EnvironmentVersionProductionGateService,
  EnvironmentVersionGateEvidenceRepository,
  SiteRouteActivationService,
  SiteFinalProbeService,
  SiteProbeResolverService,
  SiteRouteSwitchEvidenceRepository,
  UnconfiguredSiteRouteSwitchProvider,
  { provide: SiteRouteActivationPort, useExisting: SiteRouteActivationService },
  { provide: SiteProbePort, useExisting: SiteFinalProbeService },
  { provide: SiteRouteSwitchPort, useExisting: UnconfiguredSiteRouteSwitchProvider },
];
