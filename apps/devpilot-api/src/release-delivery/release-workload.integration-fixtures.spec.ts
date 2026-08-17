import { buildReleaseStagingWorkloadSnapshot } from "./release-staging-workload-snapshot.utils";
import { managedCommandWorkloadConfig } from "./release-workload.integration-fixtures";

describe("managed command integration fixture", () => {
  it("satisfies the authoritative workload snapshot contract", () => {
    const workload = buildReleaseStagingWorkloadSnapshot({
      environment: { id: "production-1", applicationServices: [{
        id: "api-1", applicationId: "app-1", releaseComponentKey: "api",
        name: "api", kind: "static", ports: [3000],
        deployConfig: managedCommandWorkloadConfig({
          healthCheckUrl: "http://127.0.0.1:3000/health",
        }),
      }] },
      manifest: { id: "manifest-1", digest: `sha256:${"a".repeat(64)}`,
        items: [{ componentKey: "api", artifactType: "zip",
          digest: `sha256:${"b".repeat(64)}`, metadata: null }] },
    }, "Production");
    expect(workload.services[0]).toMatchObject({
      executionMode: "managed-command-v1",
      statusCommand: "test -f dist/app.txt",
      failureCleanupCommand: "true",
      resources: { cpuMillicores: 100, memoryBytes: 67_108_864,
        diskBytes: 67_108_864 },
      health: { url: "http://127.0.0.1:3000/health" },
    });
  });
});
