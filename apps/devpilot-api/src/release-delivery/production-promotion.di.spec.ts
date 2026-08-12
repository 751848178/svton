import { Test } from "@nestjs/testing";
import { SiteProbePort, SiteRouteActivationPort } from "../site/site-route-activation.types";
import { SiteRouteSwitchSagaOrchestrator } from "../site/site-route-switch-saga.orchestrator";
import { SiteRouteSwitchSagaReadbackService } from "../site/site-route-switch-saga-readback.service";
import { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { EnvironmentVersionProductionGateService } from "./environment-version-production-gate.service";
import { ProductionPromotionCommandRepository } from "./production-promotion-command.repository";
import { ProductionPromotionObservationRepository } from "./production-promotion-observation.repository";
import { ProductionPromotionEvidenceRefreshService } from "./production-promotion-evidence-refresh.service";
import { ProductionPromotionService } from "./production-promotion.service";

describe("ProductionPromotionService Nest injection", () => {
  it("resolves all runtime constructor tokens through TestingModule", async () => {
    const tokens = [
      ProductionPromotionCommandRepository,
      EnvironmentVersionProductionGateService,
      SiteRouteActivationPort,
      SiteRouteSwitchSagaOrchestrator,
      SiteRouteSwitchSagaReadbackService,
      SiteProbePort,
      ProductionPromotionObservationRepository,
      EnvironmentVersionCompletionRepository,
      ProductionPromotionEvidenceRefreshService,
    ];
    const module = await Test.createTestingModule({
      providers: [
        ProductionPromotionService,
        ...tokens.map((provide) => ({ provide, useValue: {} })),
      ],
    }).compile();

    expect(module.get(ProductionPromotionService)).toBeInstanceOf(
      ProductionPromotionService,
    );
    expect(Reflect.getMetadata("design:paramtypes", ProductionPromotionService))
      .toEqual(tokens);
    await module.close();
  });
});
