export function finalizationDependencies() {
  const allowed = gateDecision();
  return {
    completion: {
      complete: jest.fn((input) => Promise.resolve(input)),
    },
    productionGates: {
      finalize: jest.fn().mockResolvedValue(allowed),
      denied: jest.fn().mockResolvedValue(gateDecision({ allowed: false })),
    },
    promotionAwaiting: {
      wait: jest.fn().mockResolvedValue({
        status: "awaiting_validation",
        environmentVersion: null,
      }),
    },
  };
}

export function gateDecision(overrides: Record<string, unknown> = {}) {
  return {
    id: "decision-production",
    stage: "production",
    checkpoint: "production_post_deploy",
    phase: "promote",
    allowed: true,
    inputHash: "a".repeat(64),
    blockerGateIds: [],
    manualGateIds: [],
    confirmedManualGateIds: [],
    warningGateIds: [],
    deferredGateIds: [],
    evidenceOnlyGateIds: [],
    integrityErrors: [],
    decidedAt: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

export function finalizationContext() {
  return {
    input: {
      teamId: "team-1",
      actorId: "actor-1",
      projectId: "project-1",
      environmentId: "environment-1",
      kind: "upgrade",
    },
    environment: { id: "environment-1", baselineRole: "production" },
    manifest: {
      id: "manifest-1",
      digest: `sha256:${"d".repeat(64)}`,
      releaseOrderId: "order-1",
      buildRun: { id: "build-1" },
    },
    productionRun: {},
    releaseRunId: "release-1",
    frozenConfigRevisionId: "config-1",
    gateContext: {
      providerKey: "ssh-v1",
      bindingId: "binding-1",
      workloadHealthConfigured: true,
    },
    run: { id: "deployment-1" },
    frozenInput: {
      deploymentInput: {
        snapshot: {
          inputHash: "b".repeat(64),
          target: { targetRef: "server-1/service-1" },
        },
      },
      workload: {
        inputHash: "c".repeat(64),
        services: [{ serviceKey: "web" }],
      },
    },
  };
}
