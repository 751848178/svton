import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("release dependency store migration contract", () => {
  const root = process.cwd();
  const sql = readFileSync(join(root,
    "prisma/migrations/20260811210000_release_dependency_store/migration.sql"),
  "utf8");
  const leaseSql = readFileSync(join(root,
    "prisma/migrations/20260811220000_dependency_store_lease_identity/migration.sql"),
  "utf8");
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");

  it("persists the complete fetch state machine and immutable identity", () => {
    expect(sql).toContain("CREATE TABLE `ReleaseDependencyFetchRun`");
    for (const state of ["queued", "fetching", "verifying", "succeeded",
      "failed", "blocked", "unavailable"]) expect(schema).toContain(state);
    expect(sql).toContain("UNIQUE INDEX `DependencyFetch_combination_key`");
    expect(leaseSql).toContain("`leaseTokenHash` VARCHAR(191) NULL");
    expect(leaseSql).toContain("DROP COLUMN `leaseToken`");
    expect(leaseSql).toContain("`storeDigest` = NULL");
    expect(leaseSql).toContain("`leaseExpiresAt` DATETIME(3) NULL");
    expect(schema).toContain(
      'combinationHash      String   @unique(map: "DependencyFetch_combination_key")',
    );
  });

  it("freezes exact fetch and store identity on BuildRun", () => {
    expect(sql).toContain("`dependencyFetchRunId` VARCHAR(191) NULL");
    expect(sql).toContain("`dependencyStoreDigest` VARCHAR(191) NULL");
    expect(sql).toContain("ON DELETE RESTRICT ON UPDATE CASCADE");
    expect(schema).toContain("dependencyFetchRunId String?");
    expect(schema).toContain("dependencyStoreDigest String?");
    for (const field of ["profileSnapshotHash", "supplyChainDigest", "fetchImage",
      "jobImage", "platformAbi", "platformLibc"]) {
      expect(leaseSql).toContain(`\`${field}\``);
      expect(schema).toContain(field);
    }
    expect(leaseSql).toContain("`fetchImage` VARCHAR(512) NULL");
    expect(leaseSql).toContain("`jobImage` VARCHAR(512) NULL");
    expect(schema).toContain("fetchImage           String?  @db.VarChar(512)");
    expect(schema).toContain("jobImage             String?  @db.VarChar(512)");
  });
});
