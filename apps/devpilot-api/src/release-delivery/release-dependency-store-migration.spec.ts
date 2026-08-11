import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("release dependency store migration contract", () => {
  const root = process.cwd();
  const sql = readFileSync(join(root,
    "prisma/migrations/20260811210000_release_dependency_store/migration.sql"),
  "utf8");
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");

  it("persists the complete fetch state machine and immutable identity", () => {
    expect(sql).toContain("CREATE TABLE `ReleaseDependencyFetchRun`");
    for (const state of ["queued", "fetching", "verifying", "succeeded",
      "failed", "blocked", "unavailable"]) expect(schema).toContain(state);
    expect(sql).toContain("UNIQUE INDEX `DependencyFetch_combination_key`");
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
  });
});
