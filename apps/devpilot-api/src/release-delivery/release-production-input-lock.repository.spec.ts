import {
  lockProductionDeploymentInputs,
  resolveAndLockProductionEnvironment,
} from "./release-production-input-lock.repository";
import { buildReleaseDeploymentInputSnapshot } from "./release-deployment-input-snapshot.utils";

describe("Production deployment input locks", () => {
  it("locks the exact Production environment before all frozen input rows", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ id: "production-1" }])
      .mockResolvedValueOnce([{ id: "revision-1" }])
      .mockResolvedValueOnce([{ id: "binding-1" }])
      .mockResolvedValueOnce([{ id: "server-1" }]);
    const tx = { $queryRaw: query } as never;
    const environmentId = await resolveAndLockProductionEnvironment(tx, scope);
    await lockProductionDeploymentInputs(tx, { ...scope, environmentId }, snapshot());
    expect(environmentId).toBe("production-1");
    expect(sql(query.mock.calls[0][0])).toContain("baselineRole = 'production'");
    expect(sql(query.mock.calls[1][0])).toContain("EnvironmentConfigRevision");
    expect(sql(query.mock.calls[2][0])).toContain("ProjectEnvironmentServer");
    expect(sql(query.mock.calls[3][0])).toContain("Server");
  });

  it("fails closed when a frozen input row disappeared", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ id: "revision-1" }])
      .mockResolvedValueOnce([]);
    await expect(lockProductionDeploymentInputs(
      { $queryRaw: query } as never,
      { ...scope, environmentId: "production-1" }, snapshot(),
    )).rejects.toThrow("部署输入已漂移");
  });
});

const scope = { teamId: "team-1", projectId: "project-1" };

function snapshot() {
  return buildReleaseDeploymentInputSnapshot({
    environmentId: "production-1",
    revision: { id: "revision-1", revision: 1, snapshotHash: "snapshot-1",
      plainVariables: {}, secretReferences: [], resourceReferences: [],
      routeSnapshot: {}, observabilitySnapshot: {} },
    bindings: [{ id: "binding-1", metadata: {
      releaseDeployment: { providerKey: "ssh-v1", root: "/srv/app" },
    }, updatedAt: new Date(0),
      server: { id: "server-1", host: "prod.internal", port: 22,
        username: "deploy", authType: "key", credentials: "cipher",
        status: "online", updatedAt: new Date(0) } }],
    secrets: [], resources: [],
  }, "ssh-v1", [], {}).snapshot;
}

function sql(value: { strings?: string[]; sql?: string }) {
  return value.sql ?? value.strings?.join("?") ?? "";
}
