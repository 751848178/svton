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
