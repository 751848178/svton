import { detectRepositoryMigrationEvidence } from "./repository-migration-evidence.utils";
import type {
  DetectedService,
  RepositoryInventory,
} from "./repository-parser.types";

describe("detectRepositoryMigrationEvidence", () => {
  it("proves migration is not applicable only from an empty exact surface", () => {
    expect(
      detectRepositoryMigrationEvidence(inventory(["package.json"]), []),
    ).toEqual({
      providerKey: "repository_inventory_v1",
      applicable: false,
      reasonCode: "no_schema_or_migration_surface",
      detectedFiles: [],
      commandServices: [],
      databaseKinds: [],
    });
  });

  it("keeps schema files, migrate commands, and databases fail-closed", () => {
    const result = detectRepositoryMigrationEvidence(
      inventory(["apps/api/prisma/schema.prisma"]),
      [service({ migrate: "prisma migrate deploy" }, ["mysql"])],
    );
    expect(result).toMatchObject({
      applicable: true,
      reasonCode: "migration_surface_detected",
      detectedFiles: ["apps/api/prisma/schema.prisma"],
      commandServices: ["api"],
      databaseKinds: ["mysql"],
    });
  });
});

function inventory(files: string[]): RepositoryInventory {
  return { files, totalFiles: files.length, totalBytes: 1, manifests: {} };
}

function service(
  commands: DetectedService["commands"],
  databases: string[],
): DetectedService {
  return {
    key: "api",
    name: "api",
    path: "apps/api",
    role: "backend",
    deployable: true,
    artifactOnly: false,
    framework: [],
    versions: {},
    commands,
    ports: [],
    healthChecks: [],
    environment: [],
    databases,
    dependencies: [],
    container: { composeFiles: [], composeServices: [], dependsOn: [] },
    artifacts: [],
    evidence: [],
    warnings: [],
  };
}
