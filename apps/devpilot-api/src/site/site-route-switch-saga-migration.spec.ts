import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Site route saga migration contract", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20260810233000_site_route_switch_saga/migration.sql",
    ),
    "utf8",
  );

  it("commits only a completed run with the matching current version and Site route", () => {
    expect(sql).toContain("dr.`status` = 'completed'");
    expect(sql).toContain("pe.`currentEnvironmentVersionId` = ev.`id`");
    expect(sql).toContain("s.`routeSwitch`, '$.deploymentRunId'");
    expect(sql).toContain("s.`routeSwitch`, '$.routeHash'");
    expect(sql).toContain("receipt.observed.routeHash");
  });

  it("keeps every uncertain legacy outcome recoverable", () => {
    expect(sql).toContain("ELSE 'compensation_required'");
    expect(sql).toContain("receipt.status')) = 'not_applied'");
    expect(sql).not.toContain(
      "CASE WHEN `status` = 'switched' THEN 'committed' ELSE 'failed' END",
    );
  });
});
