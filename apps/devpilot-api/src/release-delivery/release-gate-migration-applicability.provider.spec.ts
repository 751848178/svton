import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";
import { RELEASE_GATE_DEFINITIONS } from "./release-gate-definition.catalog";
import { createReleaseGateRegistry } from "./release-gate-test-registry.spec-utils";

const NOW = new Date("2026-08-09T12:00:00.000Z");
const registry = createReleaseGateRegistry();

describe("release migration applicability gates", () => {
  it("checks D10/D11 from an exact empty repository migration surface", () => {
    const checks = evaluate(
      evidence({
        providerKey: "repository_inventory_v1",
        applicable: false,
        reasonCode: "no_schema_or_migration_surface",
        detectedFiles: [],
        commandServices: [],
        databaseKinds: [],
      }),
    );
    expect(checks.D10).toMatchObject({
      status: "checked",
      reasonCode: "schema_migration_not_applicable",
      fresh: true,
    });
    expect(checks.D11).toMatchObject({
      status: "checked",
      reasonCode: "destructive_migration_not_applicable",
      fresh: true,
    });
  });

  it("does not turn a detected or malformed surface into a pass", () => {
    for (const migrationEvidence of [
      {
        providerKey: "repository_inventory_v1",
        applicable: true,
        reasonCode: "migration_surface_detected",
        detectedFiles: ["prisma/schema.prisma"],
        commandServices: [],
        databaseKinds: ["mysql"],
      },
      {
        providerKey: "repository_inventory_v1",
        applicable: false,
        reasonCode: "no_schema_or_migration_surface",
        detectedFiles: ["migrations/001.sql"],
        commandServices: [],
        databaseKinds: [],
      },
    ]) {
      const checks = evaluate(evidence(migrationEvidence));
      expect(checks.D10.status).toBe("unchecked");
      expect(checks.D11.status).toBe("unchecked");
    }
  });
});

function evaluate(context: ReleaseGateEvidenceContext) {
  return Object.fromEntries(
    RELEASE_GATE_DEFINITIONS.filter(
      ({ id }) => id === "D10" || id === "D11",
    ).map((definition) => [
      definition.id,
      registry.evaluate(definition, context, NOW),
    ]),
  );
}

function evidence(migrationEvidence: Record<string, unknown>) {
  const at = new Date("2026-08-09T11:59:00.000Z");
  return {
    projectId: "project-1",
    project: {
      repositoryAnalysisRuns: [
        {
          id: "analysis-1",
          status: "succeeded",
          commitSha: "commit-1",
          result: { migrationEvidence },
          finishedAt: at,
          createdAt: at,
        },
      ],
    },
    buildRuns: [{ sourceCommitSha: "commit-1" }],
  } as unknown as ReleaseGateEvidenceContext;
}
