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

@Injectable()
export class SiteRouteSwitchSagaReadbackService {
  constructor(
    private readonly repository: SiteRouteSwitchSagaRepository,
    private readonly provider: SiteRouteSwitchPort,
  ) {}

  async inspect(operationId: string): Promise<SiteRouteSagaReadback> {
    const saga = await this.repository.get(operationId);
    if (!saga) return "unknown";
    if (saga.status === "prepared") return "prepared";
    if (["compensating", "compensation_required"].includes(saga.status)) {
      return "recovering";
    }
    if (["compensated", "failed"].includes(saga.status)) return "terminal";
    if (!["applying", "switched", "committed"].includes(saga.status)) {
      return "unknown";
    }
    if (saga.providerKey !== this.provider.identity.providerKey) return "unknown";
    await this.provider.verifyProductionCapability();
    const desired = routeInput(saga.desiredRoute);
    const observed = await this.provider.observeRoute(operationId);
    if (!routeWasApplied(desired, observed, this.provider.identity)) return "unknown";
    if (saga.status === "applying") {
      if (!(await this.repository.markSwitched(operationId, observed))) return "unknown";
      return "switched";
    }
    return saga.status === "committed" ? "committed" : "switched";
  }
}

function routeInput(value: unknown): SiteRouteSwitchInput {
  if (!value || typeof value !== "object") {
    throw new Error("SITE_ROUTE_SAGA_INPUT_INVALID");
  }
  return value as SiteRouteSwitchInput;
}
