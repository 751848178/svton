import { SiteFinalProbeService } from "../site/site-final-probe.service";
import { ProductionRouteSagaGuard } from "../site/production-route-saga.guard";
import { SiteProbeResolverService } from "../site/site-probe-resolver.service";
import { SiteProbeLocalAcceptancePolicy } from "../site/site-probe-local-acceptance.policy";
import { SiteRouteActivationService } from "../site/site-route-activation.service";
import {
  SiteProbePort,
  SiteRouteActivationPort,
} from "../site/site-route-activation.types";
import { SiteRouteSwitchEvidenceRepository } from "../site/site-route-switch-evidence.repository";
import { SiteRouteSwitchSagaOrchestrator } from "../site/site-route-switch-saga.orchestrator";
import { SiteRouteSwitchSagaRecoveryService } from "../site/site-route-switch-saga-recovery.service";
import { SiteRouteSwitchSagaRecoveryRepository } from "../site/site-route-switch-saga-recovery.repository";
import { SiteRouteSwitchSagaReadbackService } from "../site/site-route-switch-saga-readback.service";
import { SiteRouteSwitchSagaRepository } from "../site/site-route-switch-saga.repository";
import { ConfiguredSiteRouteSwitchProvider } from "../site/configured-site-route-switch-provider.service";
import { HttpSiteRouteSwitchProvider } from "../site/http-site-route-switch-provider.service";
import {
  SiteRouteSwitchPort,
  UnconfiguredSiteRouteSwitchProvider,
} from "../site/site-route-switch.port";
import { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionRecoveryRepository } from "./environment-version-recovery.repository";
import { EnvironmentVersionRecoveryService } from "./environment-version-recovery.service";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { EnvironmentVersionService } from "./environment-version.service";
import { ProductionPromotionAwaitingRepository } from "./production-promotion-awaiting.repository";
import { ProductionPromotionCommandRepository } from "./production-promotion-command.repository";
import { ProductionPromotionObservationRepository } from "./production-promotion-observation.repository";
import { ProductionPromotionService } from "./production-promotion.service";
import { ProductionPromotionRecoveryRepository } from "./production-promotion-recovery.repository";
import { ProductionPromotionRecoveryService } from "./production-promotion-recovery.service";
import { ProductionPromotionReconcileRepository } from "./production-promotion-reconcile.repository";
import { ProductionPromotionReconcileService } from "./production-promotion-reconcile.service";

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
  ProductionPromotionAwaitingRepository,
  ProductionPromotionCommandRepository,
  ProductionPromotionObservationRepository,
  ProductionPromotionService,
  ProductionPromotionRecoveryRepository,
  ProductionPromotionRecoveryService,
  ProductionPromotionReconcileRepository,
  ProductionPromotionReconcileService,
  ProductionRouteSagaGuard,
  SiteRouteActivationService,
  SiteFinalProbeService,
  SiteProbeResolverService,
  SiteProbeLocalAcceptancePolicy,
  SiteRouteSwitchEvidenceRepository,
  SiteRouteSwitchSagaRepository,
  SiteRouteSwitchSagaRecoveryRepository,
  SiteRouteSwitchSagaOrchestrator,
  SiteRouteSwitchSagaRecoveryService,
  SiteRouteSwitchSagaReadbackService,
  HttpSiteRouteSwitchProvider,
  UnconfiguredSiteRouteSwitchProvider,
  ConfiguredSiteRouteSwitchProvider,
  { provide: SiteRouteActivationPort, useExisting: SiteRouteActivationService },
  { provide: SiteProbePort, useExisting: SiteFinalProbeService },
  {
    provide: SiteRouteSwitchPort,
    useExisting: ConfiguredSiteRouteSwitchProvider,
  },
];
