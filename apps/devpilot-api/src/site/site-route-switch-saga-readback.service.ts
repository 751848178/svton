import { Injectable } from "@nestjs/common";
import { SiteRouteSwitchPort } from "./site-route-switch.port";
import { routeWasApplied } from "./site-route-switch-saga.policy";
import { SiteRouteSwitchSagaRepository } from "./site-route-switch-saga.repository";
import type { SiteRouteSwitchInput } from "./site-route-switch.types";

export type SiteRouteSagaReadback =
  | "prepared"
  | "switched"
  | "committed"
  | "recovering"
  | "terminal"
  | "unknown";

export type ExactSiteRouteSagaReadback = {
  state: SiteRouteSagaReadback | "not_switched";
  providerKey: string | null;
  operationId: string;
};

@Injectable()
export class SiteRouteSwitchSagaReadbackService {
  constructor(
    private readonly repository: SiteRouteSwitchSagaRepository,
    private readonly provider: SiteRouteSwitchPort,
  ) {}

  async inspect(operationId: string): Promise<SiteRouteSagaReadback> {
    const exact = await this.inspectExact(operationId);
    return exact.state === "not_switched" ? "terminal" : exact.state;
  }

  async inspectExact(operationId: string): Promise<ExactSiteRouteSagaReadback> {
    const saga = await this.repository.get(operationId);
    if (!saga) return result(operationId, null, "unknown");
    if (["compensating", "compensation_required"].includes(saga.status)) {
      return result(operationId, saga.providerKey, "recovering");
    }
    if (!["prepared", "applying", "switched", "committed", "compensated", "failed"]
      .includes(saga.status)) {
      return result(operationId, saga.providerKey, "unknown");
    }
    if (saga.providerKey !== this.provider.identity.providerKey) {
      return result(operationId, saga.providerKey, "unknown");
    }
    await this.provider.verifyProductionCapability();
    const desired = routeInput(saga.desiredRoute);
    const observed = await this.provider.observeRoute(operationId);
    const applied = routeWasApplied(desired, observed, this.provider.identity);
    if (["prepared", "compensated", "failed"].includes(saga.status)) {
      return result(operationId, saga.providerKey, applied ? "unknown" : "not_switched");
    }
    if (!applied) return result(operationId, saga.providerKey, "unknown");
    if (saga.status === "applying") {
      if (!(await this.repository.markSwitched(operationId, observed))) {
        return result(operationId, saga.providerKey, "unknown");
      }
      return result(operationId, saga.providerKey, "switched");
    }
    return result(operationId, saga.providerKey,
      saga.status === "committed" ? "committed" : "switched");
  }
}

function result(
  operationId: string,
  providerKey: string | null,
  state: ExactSiteRouteSagaReadback["state"],
): ExactSiteRouteSagaReadback {
  return { operationId, providerKey, state };
}

function routeInput(value: unknown): SiteRouteSwitchInput {
  if (!value || typeof value !== "object") {
    throw new Error("SITE_ROUTE_SAGA_INPUT_INVALID");
  }
  return value as SiteRouteSwitchInput;
}
