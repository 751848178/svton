import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("release component key migration", () => {
  const sql = readFileSync(join(
    process.cwd(),
    "prisma/migrations/20260811120000_release_component_key/migration.sql",
  ), "utf8");

  it("backfills only exact active governed baseline pairs", () => {
    expect(sql).toContain("environment.`status` = 'active'");
    expect(sql).toContain("environment.`baselineRole` IN ('staging', 'production')");
    expect(sql).toContain("HAVING COUNT(*) = 2");
    expect(sql).toContain("COUNT(DISTINCT environment.`baselineRole`) = 2");
    expect(sql).toContain("WHERE service.`releaseComponentKey` IS NULL");
  });

  it("uses a deterministic normalized application service identity", () => {
    expect(sql).toContain("service.`applicationId`, CHAR(31), LOWER(TRIM(service.`name`))");
    expect(sql).toContain("CONCAT(\n    'legacy-',\n    SHA2(");
  });

  it("does not rewrite immutable release history", () => {
    expect(sql).not.toMatch(/UPDATE\s+`?(ArtifactManifest|DeploymentRun|EnvironmentVersion)`?/i);
    expect(sql.indexOf("UPDATE `ApplicationService`")).toBeLessThan(
      sql.indexOf("CREATE UNIQUE INDEX"),
    );
  });
});
