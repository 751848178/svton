import { ConflictException } from "@nestjs/common";
import {
  buildReleaseDeploymentInputSnapshot,
  selectReleaseDeploymentTarget,
} from "./release-deployment-input-snapshot.utils";
import type { ReleaseDeploymentInputState } from "./release-deployment-input.types";

/**
 * F446 AC-SET-031 frozen snapshot assertions: buildReleaseDeploymentInputSnapshot
 * must freeze the resource references (id/kind/name/status/environmentId/
 * sharedEnvironmentIds/versionHash) exactly as they were at revision time.
 * The semantics were built in F432; this spec pins them against regressions.
 */

function state(overrides: Partial<ReleaseDeploymentInputState> = {}): ReleaseDeploymentInputState {
  return {
    environmentId: "env-1",
    revision: {
      id: "rev-4",
      revision: 4,
      snapshotHash: "sha256:snapshot",
      plainVariables: { DATABASE_URL: "postgres://db" },
      secretReferences: [],
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1", name: "pg-shared-nonprod",
        sharedEnvironmentIds: ["env-1", "env-2"], risk: "medium", impact: "both",
      }],
    },
    secrets: [],
    resources: [{
      id: "resource-1",
      kind: "managed_resource",
      name: "pg-shared-nonprod",
      status: "active",
      environmentId: "env-1",
      sharedEnvironmentIds: ["env-1", "env-2"],
      updatedAt: new Date("2026-07-01T00:00:00Z"),
      runtime: { delivery: {}, credentials: null, envTemplate: "DATABASE_URL=...\nSCHEMA=picshare_stg\n" },
    }],
    bindings: [{
      id: "binding-1",
      metadata: { releaseDeployment: { providerKey: "ssh-v1", root: "/srv/app" } },
      updatedAt: new Date("2026-07-01T00:00:00Z"),
      server: {
        id: "server-1", host: "10.0.0.1", port: 22, username: "deploy",
        authType: "ssh", credentials: "cred-1", updatedAt: new Date("2026-07-01T00:00:00Z"),
      },
    }],
    ...overrides,
  };
}

describe("release deployment input snapshot (AC-SET-031 frozen)", () => {
  it("freezes resource id/kind/name/status/environmentId/sharedEnvironmentIds/versionHash", () => {
    const { snapshot } = buildReleaseDeploymentInputSnapshot(state(), "ssh-v1", ["DATABASE_URL"]);
    expect(snapshot.version).toBe(1);
    expect(snapshot.configRevision).toMatchObject({
      id: "rev-4", revision: 4, snapshotHash: "sha256:snapshot",
    });
    expect(snapshot.resourceReferences).toHaveLength(1);
    expect(snapshot.resourceReferences[0]).toMatchObject({
      id: "resource-1",
      kind: "managed_resource",
      name: "pg-shared-nonprod",
      status: "active",
      environmentId: "env-1",
      sharedEnvironmentIds: ["env-1", "env-2"],
    });
    expect(snapshot.resourceReferences[0].versionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.resourceReferences[0].environmentKeys).toEqual(["DATABASE_URL", "SCHEMA"]);
    expect(snapshot.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("covers the resource references in the stateHash", () => {
    const left = buildReleaseDeploymentInputSnapshot(state(), "ssh-v1", []);
    const right = buildReleaseDeploymentInputSnapshot(
      state({
        revision: {
          ...state().revision,
          resourceReferences: [{
            ...(state().revision.resourceReferences as Array<Record<string, unknown>>)[0],
            sharedEnvironmentIds: ["env-1"],
          }],
        },
      }),
      "ssh-v1",
      [],
    );
    expect(left.snapshot.configRevision.stateHash).not.toBe(right.snapshot.configRevision.stateHash);
  });

  it("sorts resource references deterministically by id", () => {
    const { snapshot } = buildReleaseDeploymentInputSnapshot(
      state({
        resources: [
          { ...state().resources[0], id: "b" },
          { ...state().resources[0], id: "a" },
        ],
      }),
      "ssh-v1",
      [],
    );
    expect(snapshot.resourceReferences.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("keeps the frozen snapshot independent of later resource changes", () => {
    const frozen = buildReleaseDeploymentInputSnapshot(state(), "ssh-v1", []);
    const later = buildReleaseDeploymentInputSnapshot(
      state({
        resources: [{
          ...state().resources[0],
          status: "released",
          environmentId: null,
          sharedEnvironmentIds: ["env-1"],
          updatedAt: new Date("2026-08-01T00:00:00Z"),
        }],
      }),
      "ssh-v1",
      [],
    );
    expect(frozen.snapshot.resourceReferences[0].status).toBe("active");
    expect(frozen.snapshot.resourceReferences[0].environmentId).toBe("env-1");
    expect(later.snapshot.resourceReferences[0].status).toBe("released");
    expect(frozen.snapshot.inputHash).not.toBe(later.snapshot.inputHash);
  });

  it("selects the provider-matched deployment target and rejects ambiguous matches", () => {
    expect(selectReleaseDeploymentTarget(state(), "ssh-v1").binding.id).toBe("binding-1");
    expect(() => selectReleaseDeploymentTarget(
      state({
        bindings: [
          state().bindings[0],
          { ...state().bindings[0], id: "binding-2" },
        ],
      }),
      "ssh-v1",
    )).toThrow(ConflictException);
  });
});
