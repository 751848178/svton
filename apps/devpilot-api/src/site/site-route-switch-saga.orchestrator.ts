import { Injectable } from "@nestjs/common";
import { SiteRouteSwitchPort } from "./site-route-switch.port";
import {
  compensationOperationId,
  compensationWasApplied,
  routeSwitchError,
  routeWasApplied,
  verifiedCurrentRoute,
} from "./site-route-switch-saga.policy";
import { SiteRouteSwitchSagaRepository } from "./site-route-switch-saga.repository";
import type {
  SiteRouteSwitchAttemptPersistence,
  SiteRouteSwitchEvidence,
  SiteRouteSwitchInput,
  SiteRouteSwitchReceipt,
} from "./site-route-switch.types";

export type SiteRouteCompensationResult =
  | "compensated"
  | "compensation_required"
  | "not_applied"
  | "terminal";

@Injectable()
export class SiteRouteSwitchSagaOrchestrator {
  constructor(
    private readonly repository: SiteRouteSwitchSagaRepository,
    private readonly provider: SiteRouteSwitchPort,
  ) {}

  async assertProductionReady() {
    await this.provider.verifyProductionCapability();
    if (!this.provider.supportsCompensation) {
      throw new Error("SITE_ROUTE_SWITCH_COMPENSATION_UNAVAILABLE");
    }
  }

  async apply(
    input: SiteRouteSwitchInput,
  ): Promise<SiteRouteSwitchAttemptPersistence> {
    await this.assertProductionReady();
    const prepared = await this.repository.prepare(
      input,
      this.provider.identity.providerKey,
    );
    const preparedDesired = routeInput(prepared.desiredRoute);
    const replay = sagaReceipt(prepared.applyReceipt);
    if (prepared.providerKey !== this.provider.identity.providerKey) {
      throw new Error("SITE_ROUTE_SAGA_PROVIDER_MISMATCH");
    }
    if (prepared.status === "switched" && replay) {
      return {
        evidence: evidence(
          preparedDesired,
          replay,
          this.provider.identity.providerKey,
        ),
      };
    }
    if (prepared.status !== "prepared") {
      throw new Error(`SITE_ROUTE_SAGA_${prepared.status.toUpperCase()}`);
    }
    const current = verifiedCurrentRoute(
      await this.provider.observeCurrentRoute(input),
      this.provider.identity,
    );
    const frozenDesired = {
      ...input,
      expectedCurrent: current.expectedCurrent,
    };
    if (
      !(await this.repository.freezePrevious(
        input.operationId,
        frozenDesired,
        current.previous,
      ))
    ) {
      throw new Error("SITE_ROUTE_SAGA_FREEZE_CONFLICT");
    }
    if (!(await this.repository.markApplying(frozenDesired.operationId))) {
      throw new Error("SITE_ROUTE_SAGA_APPLY_CONFLICT");
    }
    const receipt = await this.provider.switchRoute(frozenDesired);
    if (!routeWasApplied(frozenDesired, receipt, this.provider.identity)) {
      throw new Error(`SITE_ROUTE_SWITCH_FAILED:${receipt.reasonCode}`);
    }
    if (
      !(await this.repository.markSwitched(frozenDesired.operationId, receipt))
    ) {
      throw new Error("SITE_ROUTE_SAGA_RECEIPT_CONFLICT");
    }
    return {
      evidence: evidence(
        frozenDesired,
        receipt,
        this.provider.identity.providerKey,
      ),
    };
  }

  async compensate(
    operationId: string,
    cause: unknown,
  ): Promise<SiteRouteCompensationResult> {
    const saga = await this.repository.get(operationId);
    if (!saga || ["committed", "compensated", "failed"].includes(saga.status)) {
      return "terminal";
    }
    if (saga.status === "prepared") {
      await this.repository.markFailed(operationId, routeSwitchError(cause));
      return "not_applied";
    }
    const desired = routeInput(saga.desiredRoute);
    const previous = nullableRouteInput(saga.previousRoute);
    const compensationId = compensationOperationId(operationId);
    if (
      !(await this.repository.claimCompensation(operationId, compensationId))
    ) {
      return "terminal";
    }
    try {
      if (saga.providerKey !== this.provider.identity.providerKey) {
        throw new Error("SITE_ROUTE_SAGA_PROVIDER_MISMATCH");
      }
      const observed = await this.provider.observeRoute(operationId);
      if (!routeWasApplied(desired, observed, this.provider.identity)) {
        throw new Error(
          `SITE_ROUTE_APPLY_STATE_UNKNOWN:${observed.reasonCode}`,
        );
      }
      const receipt = await this.provider.compensateRoute({
        version: 1,
        operationId: compensationId,
        originalOperationId: operationId,
        expectedCurrent: observed.observed!,
        desiredRoute: previous,
      });
      const verified = compensationWasApplied(
        compensationId,
        previous,
        receipt,
        this.provider.identity,
      )
        ? receipt
        : await this.provider.observeRoute(compensationId);
      if (
        !compensationWasApplied(
          compensationId,
          previous,
          verified,
          this.provider.identity,
        )
      ) {
        throw new Error(
          `SITE_ROUTE_COMPENSATION_UNVERIFIED:${verified.reasonCode}`,
        );
      }
      await this.repository.markCompensated(operationId, verified);
      return "compensated";
    } catch (error) {
      await this.repository.requireCompensation(
        operationId,
        `${routeSwitchError(cause)}; ${routeSwitchError(error)}`,
      );
      return "compensation_required";
    }
  }
}

function evidence(
  input: SiteRouteSwitchInput,
  receipt: SiteRouteSwitchReceipt,
  providerKey: string,
): SiteRouteSwitchEvidence {
  return {
    ...input,
    providerKey,
    status: "switched",
    reasonCode: "site_route_switched",
    switchedAt: receipt.observedAt,
    receipt,
  };
}

function sagaReceipt(value: unknown): SiteRouteSwitchReceipt | null {
  return value && typeof value === "object"
    ? (value as SiteRouteSwitchReceipt)
    : null;
}
function routeInput(value: unknown): SiteRouteSwitchInput {
  if (!value || typeof value !== "object")
    throw new Error("SITE_ROUTE_SAGA_INPUT_INVALID");
  return value as SiteRouteSwitchInput;
}

function nullableRouteInput(value: unknown): SiteRouteSwitchInput | null {
  return value && typeof value === "object"
    ? (value as SiteRouteSwitchInput)
    : null;
}
