import {
  createSiteRouteSwitchInput,
  siteRouteSwitchEvidence,
  validateSiteRouteSwitchReceipt,
} from "./site-route-switch-receipt.policy";
import type { SiteRouteSwitchReceipt } from "./site-route-switch.types";

describe("site route switch receipt policy", () => {
  const input = createSiteRouteSwitchInput({
    teamId: "team-1",
    projectId: "project-1",
    environmentId: "environment-1",
    deploymentRunId: "deployment-1",
    releaseRunId: "release-1",
    targetRef: "server-1/service-1",
    activation: {
      siteId: "site-1",
      primaryDomain: "app.example.com",
      domains: ["www.example.com", "app.example.com"],
      proxyTarget: "http://service.internal:8080",
      status: "matched",
      reasonCode: "site_route_matched",
    },
  });

  function validReceipt(): SiteRouteSwitchReceipt {
    return {
      version: 1,
      providerKey: "test-provider",
      operationId: input.operationId,
      status: "switched",
      reasonCode: "provider_switched",
      observedAt: "2026-08-08T06:00:00.000Z",
      observed: {
        siteId: input.siteId,
        deploymentRunId: input.deploymentRunId,
        targetRef: input.targetRef,
        routeHash: input.routeHash,
      },
    };
  }

  it("accepts only an exact read-after-write receipt", () => {
    const receipt = validReceipt();
    expect(validateSiteRouteSwitchReceipt(input, receipt)).toEqual({
      accepted: true,
      reasonCode: "site_route_switched",
    });
    expect(siteRouteSwitchEvidence(input, receipt)).toMatchObject({
      deploymentRunId: "deployment-1",
      targetRef: "server-1/service-1",
      routeHash: input.routeHash,
      status: "switched",
      switchedAt: receipt.observedAt,
    });
  });

  it.each([
    ["operation", { operationId: "stale-operation" }, "route_switch_operation_mismatch"],
    ["missing readback", { observed: null }, "route_switch_readback_missing"],
    ["site", { observed: { ...validReceipt().observed!, siteId: "site-2" } }, "route_switch_site_mismatch"],
    ["deployment", { observed: { ...validReceipt().observed!, deploymentRunId: "deployment-2" } }, "route_switch_deployment_mismatch"],
    ["target", { observed: { ...validReceipt().observed!, targetRef: "target-2" } }, "route_switch_target_mismatch"],
    ["hash", { observed: { ...validReceipt().observed!, routeHash: "stale-hash" } }, "route_switch_hash_mismatch"],
    ["observedAt", { observedAt: null }, "route_switch_observed_at_invalid"],
  ])("rejects a mismatched %s", (_label, patch, reasonCode) => {
    expect(validateSiteRouteSwitchReceipt(input, { ...validReceipt(), ...patch })).toEqual({
      accepted: false,
      reasonCode,
    });
  });

  it("keeps an unavailable provider truthful and non-switched", () => {
    const evidence = siteRouteSwitchEvidence(input, {
      ...validReceipt(),
      providerKey: "unconfigured",
      status: "unavailable",
      reasonCode: "route_switch_provider_unconfigured",
      observedAt: null,
      observed: null,
    });
    expect(evidence).toMatchObject({
      status: "unavailable",
      reasonCode: "route_switch_provider_unconfigured",
      switchedAt: null,
    });
  });

  it("derives a stable operation id from canonical route identity", () => {
    const reordered = createSiteRouteSwitchInput({
      teamId: input.teamId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      deploymentRunId: input.deploymentRunId,
      releaseRunId: input.releaseRunId,
      targetRef: input.targetRef,
      activation: {
        siteId: input.siteId,
        primaryDomain: input.primaryDomain,
        domains: [...input.domains].reverse(),
        proxyTarget: input.proxyTarget,
        status: "matched",
        reasonCode: "site_route_matched",
      },
    });
    expect(reordered.routeHash).toBe(input.routeHash);
    expect(reordered.operationId).toBe(input.operationId);
  });
});
