import type { StagingArtifactInput } from "./release-staging.types";

/**
 * 环境版本执行集成测试可复用的 Deployment Provider 测试替身。
 * 必须暴露 providerKey/providerTargetRef（reserve 会校验非空）。
 */
export function environmentVersionExecutorTestDouble() {
  return {
    providerKey: "provider-test-v1",
    providerTargetRef: "provider-test-target",
    deploy: async (input: StagingArtifactInput) => ({
      deploymentUri: `release-deployment://${input.deploymentRunId}`,
      logs: ["verified", "materialized"],
      evidence: { artifactVerified: true, checkout: false, build: false },
    }),
  };
}

export function environmentVersionInputTestDouble() {
  return {
    prepare: jest.fn(async () => ({
      snapshot: {
        version: 1,
        configRevision: {
          id: "frozen-config-revision",
          revision: 1,
          snapshotHash: "frozen-config-snapshot",
          stateHash: "frozen-config-state",
        },
        plainVariableKeys: [],
        secretReferences: [],
        resourceReferences: [],
        target: {
          bindingId: "frozen-binding",
          serverId: "frozen-server",
          providerKey: "provider-test-v1",
          targetRef: "provider-test-target",
          versionHash: "frozen-target",
        },
        runtimeEnvironmentKeys: [],
        inputHash: "frozen-input-hash",
      },
      runtimeEnvironment: {},
      targetConnection: undefined,
    })),
  };
}

export function productionWorkloadTestDouble() {
  return {
    prepare: jest.fn(async () => ({
      version: 1,
      environmentId: "frozen-environment",
      manifestId: "frozen-manifest",
      manifestDigest: "sha256:frozen",
      services: [],
      inputHash: "frozen-workload-hash",
    })),
  };
}
