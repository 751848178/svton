import { Injectable } from "@nestjs/common";
import { SiteRouteSwitchSagaReadbackService } from "../site/site-route-switch-saga-readback.service";
import { ProductionPromotionReconcileRepository } from "./production-promotion-reconcile.repository";
import type { ProductionPromotionReconcileInput } from "./production-promotion-reconcile.types";

@Injectable()
export class ProductionPromotionReconcileService {
  constructor(
    private readonly repository: ProductionPromotionReconcileRepository,
    private readonly readback: SiteRouteSwitchSagaReadbackService,
  ) {}

  async reconcile(input: ProductionPromotionReconcileInput) {
    const prepared = await this.repository.prepare(input);
    if (!prepared.shouldInspect) return prepared.audit;
    if (prepared.sagaResolution === "none_safe") {
      return this.repository.terminateBeforeProvider(prepared.audit.id);
    }
    if (prepared.sagaResolution === "ambiguous") {
      return this.repository.block(prepared.audit.id, {
        operationId: `ambiguous:${prepared.audit.id}`, providerKey: null, state: "unknown",
      }, "LEGACY_PROMOTION_SAGA_AMBIGUOUS");
    }
    const operationId = prepared.routeSwitchOperationId;
    if (!operationId || !prepared.routeProviderKey) {
      return this.repository.block(prepared.audit.id, {
        operationId: operationId ?? `missing:${prepared.audit.id}`,
        providerKey: prepared.routeProviderKey,
        state: "unknown",
      }, "LEGACY_PROMOTION_ROUTE_IDENTITY_MISSING");
    }
    try {
      const state = await this.readback.inspectExact(operationId);
      if (state.state === "committed") {
        return this.repository.convergeCommitted(prepared.audit.id, state);
      }
      if (state.state === "not_switched") {
        return this.repository.terminateNotSwitched(prepared.audit.id, state);
      }
      return this.repository.block(prepared.audit.id, state,
        "LEGACY_PROMOTION_READBACK_INCONCLUSIVE");
    } catch {
      return this.repository.block(prepared.audit.id, {
        operationId, providerKey: prepared.routeProviderKey, state: "unknown",
      }, "LEGACY_PROMOTION_PROVIDER_READBACK_FAILED");
    }
  }
}
