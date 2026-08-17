import { ReleaseGateIngressCapabilityProvider } from "./release-gate-ingress-capability.provider";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";

describe("ReleaseGateIngressCapabilityProvider local receipt", () => {
  it("accepts only an exact scoped acceptance-only resolver receipt", () => {
    const route = { domains: ["parity.example.test"], tlsRequired: false };
    const now = new Date("2026-08-12T02:00:00.000Z");
    const context = {
      decisionTarget: {
        configRevisionId: "revision-1",
        providerKey: "local-filesystem-v1",
        deploymentInputHash: "deployment-hash",
        workloadInputHash: "workload-hash",
        dnsProbeReceiptId: "receipt-1",
        dnsProbeResultHash: "result-hash",
      },
      deploy: { environment: { currentConfigRevision: {
        id: "revision-1", routeSnapshot: route,
      } } },
      promote: {
        environment: null,
        sites: [],
        dnsReceipts: [{
          providerKey: "local-filesystem-v1",
          id: "receipt-1",
          configRevisionId: "revision-1",
          providerProfile: "parity-hosts-v1",
          routeHash: hashCanonicalReleaseValue(route),
          deploymentInputHash: "deployment-hash",
          workloadInputHash: "workload-hash",
          status: "resolved",
          resultHash: "result-hash",
          probedAt: new Date("2026-08-12T01:58:00.000Z"),
          expiresAt: new Date("2026-08-12T02:13:00.000Z"),
        }],
      },
    };
    const provider = new ReleaseGateIngressCapabilityProvider();
    const gate = RELEASE_GATE_DEFINITIONS.find((item) => item.id === "D14")!;
    expect(provider.evaluate(gate, context as never, now)).toMatchObject({
      status: "checked",
      reasonCode: "local_resolver_acceptance_only",
      evidenceIdentity: { profile: "parity-hosts-v1" },
    });
    context.decisionTarget.workloadInputHash = "drifted";
    expect(provider.evaluate(gate, context as never, now)).toMatchObject({
      status: "unavailable",
      reasonCode: "dns_acceptance_receipt_scope_mismatch",
    });
  });
});
