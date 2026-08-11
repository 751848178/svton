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
    expect(sql).toContain("grouped.`applicationId`, CHAR(31), grouped.`normalizedName`");
    expect(sql).toContain("CONCAT(\n    'legacy-',\n    SHA2(");
  });

  it("derives the hash only from grouped aliases under ONLY_FULL_GROUP_BY", () => {
    const insert = sql.slice(sql.indexOf("INSERT INTO"), sql.indexOf("UPDATE `ApplicationService`"));
    const outerProjection = insert.slice(insert.indexOf("SELECT"), insert.indexOf("FROM ("));
    expect(outerProjection).not.toContain("service.");
    expect(outerProjection).toContain("grouped.`normalizedName`");
    expect(insert).toContain("LOWER(TRIM(service.`name`)) AS `normalizedName`");
    expect(insert).toContain(
      "GROUP BY service.`projectId`, service.`applicationId`, LOWER(TRIM(service.`name`))",
    );
  });

  it("keeps the exact two-role fixture semantics inside the grouped subquery", () => {
    const grouped = sql.slice(sql.indexOf("FROM ("), sql.indexOf(") AS grouped"));
    expect(grouped).toContain("environment.`status` = 'active'");
    expect(grouped).toContain("environment.`baselineRole` IN ('staging', 'production')");
    expect(grouped).toContain("HAVING COUNT(*) = 2");
    expect(grouped).toContain("COUNT(DISTINCT environment.`baselineRole`) = 2");
  });

  it("does not rewrite immutable release history", () => {
    expect(sql).not.toMatch(/UPDATE\s+`?(ArtifactManifest|DeploymentRun|EnvironmentVersion)`?/i);
    expect(sql.indexOf("UPDATE `ApplicationService`")).toBeLessThan(
      sql.indexOf("CREATE UNIQUE INDEX"),
    );
  });
});
