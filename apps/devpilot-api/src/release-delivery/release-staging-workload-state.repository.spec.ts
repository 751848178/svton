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

const stagingServices = [service("parity-svc-web", "web"), service("parity-svc-api", "api")];
const manifest = {
  id: "manifest-1",
  digest: "sha256:" + "a".repeat(64),
  items: [
    {
      componentKey: "parity-svc-api",
      digest: "sha256:" + "b".repeat(64),
      artifactType: "zip",
      metadata: null,
    },
    {
      componentKey: "parity-svc-web",
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
  environmentFindFirst.mockImplementation((args: unknown) => {
    const where = (args as { where: { id?: string; baselineRole?: string } }).where;
    if (where?.id === scope.environmentId) return Promise.resolve(environment);
    if (where?.baselineRole === "staging") {
      return Promise.resolve({ applicationServices: stagingServices });
    }
    return Promise.resolve(null);
  });
  const manifestFindFirst = jest.fn().mockResolvedValue(manifest);
  return {
    projectEnvironment: { findFirst: environmentFindFirst },
    artifactManifest: { findFirst: manifestFindFirst },
  };
}

describe("loadReleaseStagingWorkloadState (F455 production fallback)", () => {
  it("keeps the environment's own services when present", async () => {
    const own = [service("parity-svc-web-prod", "web")];
    const clientImpl = client(own);
    const result = await loadReleaseStagingWorkloadState(
      clientImpl as never,
      scope,
    );
    expect(result.environment?.applicationServices).toEqual(own);
    expect(clientImpl.projectEnvironment.findFirst).toHaveBeenCalledTimes(1);
    expect(clientImpl.artifactManifest.findFirst).toHaveBeenCalledTimes(1);
  });

  it("falls back to the active Staging-baseline services when the environment has none", async () => {
    const clientImpl = client([]);
    const result = await loadReleaseStagingWorkloadState(
      clientImpl as never,
      scope,
    );
    expect(result.environment?.applicationServices).toEqual(stagingServices);
    const fallbackCall = clientImpl.projectEnvironment.findFirst.mock.calls.find(
      (args) =>
        (args[0] as { where?: { baselineRole?: string } }).where
          ?.baselineRole === "staging",
    );
    expect(fallbackCall).toBeDefined();
    const where = (fallbackCall![0] as { where: { teamId: string; projectId: string; baselineRole: string } }).where;
    expect(where).toMatchObject({
      teamId: scope.teamId,
      projectId: scope.projectId,
      baselineRole: "staging",
    });
    expect(result.manifest?.items.map((item) => item.componentKey)).toEqual([
      "parity-svc-api",
      "parity-svc-web",
    ]);
  });

  it("returns an empty service list when no Staging baseline exists", async () => {
    const clientImpl = client([]);
    clientImpl.projectEnvironment.findFirst.mockImplementation((args: unknown) => {
      const where = (args as { where: { id?: string; baselineRole?: string } }).where;
      if (where?.id === scope.environmentId) {
        return Promise.resolve({ id: scope.environmentId, applicationServices: [] });
      }
      return Promise.resolve(null);
    });
    const result = await loadReleaseStagingWorkloadState(
      clientImpl as never,
      scope,
    );
    expect(result.environment?.applicationServices).toEqual([]);
  });
});
