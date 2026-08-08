import { loadReleaseStagingWorkloadState } from "./release-staging-workload-state.repository";

const scope = {
  teamId: "parity-team-0001",
  projectId: "parity-project-0001",
  environmentId: "parity-env-production",
  manifestId: "manifest-1",
  baselineRole: "production" as const,
};

function service(id: string, name: string) {
  return {
    id,
    applicationId: "application-1",
    name,
    kind: "static",
    deployConfig: {
      workingDirectory: "apps/web",
      buildCommand: "node scripts/build.mjs",
      artifactPaths: ["apps/web/dist"],
      workloadExecutionMode: "managed-command-v1",
      deployCommand: "test -f dist/index.html",
      statusCommand: "test -f dist/index.html",
      failureCleanupCommand: "true",
    },
  };
}

const productionServices = [
  service("parity-svc-web-production", "web"),
  service("parity-svc-api-production", "api"),
];
const manifest = {
  id: "manifest-1",
  digest: "sha256:" + "a".repeat(64),
  items: [
    {
      componentKey: "parity-svc-api-production",
      digest: "sha256:" + "b".repeat(64),
      artifactType: "zip",
      metadata: null,
    },
    {
      componentKey: "parity-svc-web-production",
      digest: "sha256:" + "c".repeat(64),
      artifactType: "zip",
      metadata: null,
    },
  ],
};

function client(environmentServices: unknown[]) {
  const environment = {
    id: scope.environmentId,
    applicationServices: environmentServices,
  };
  const environmentFindFirst = jest.fn();
  environmentFindFirst.mockResolvedValue(environment);
  const manifestFindFirst = jest.fn().mockResolvedValue(manifest);
  return {
    projectEnvironment: { findFirst: environmentFindFirst },
    artifactManifest: { findFirst: manifestFindFirst },
  };
}

describe("loadReleaseStagingWorkloadState (F469 environment isolation)", () => {
  it("loads the requested Production environment's own services", async () => {
    const clientImpl = client(productionServices);
    const result = await loadReleaseStagingWorkloadState(
      clientImpl as never,
      scope,
    );
    expect(result.environment?.applicationServices).toEqual(productionServices);
    expect(clientImpl.projectEnvironment.findFirst).toHaveBeenCalledTimes(1);
    expect(clientImpl.projectEnvironment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: scope.environmentId,
          baselineRole: "production",
        }),
      }),
    );
    expect(clientImpl.artifactManifest.findFirst).toHaveBeenCalledTimes(1);
    expect(result.manifest?.items.map((item) => item.componentKey)).toEqual([
      "parity-svc-api-production",
      "parity-svc-web-production",
    ]);
  });

  it("keeps Production empty instead of borrowing Staging services", async () => {
    const clientImpl = client([]);
    const result = await loadReleaseStagingWorkloadState(
      clientImpl as never,
      scope,
    );
    expect(result.environment?.applicationServices).toEqual([]);
    expect(clientImpl.projectEnvironment.findFirst).toHaveBeenCalledTimes(1);
  });
});
