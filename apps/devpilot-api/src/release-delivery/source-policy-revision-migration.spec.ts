import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("SourcePolicyRevision migration", () => {
  it("creates immutable project revisions and a current pointer", async () => {
    const sql = await readFile(
      resolve(
        __dirname,
        "../../prisma/migrations/20260811130000_source_policy_revision/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE `SourcePolicyRevision`");
    expect(sql).toContain("externalRequiredChecks");
    expect(sql).toContain("requiredIndependentApprovals");
    expect(sql).toContain("Project_currentSourcePolicyRevisionId_fkey");
    expect(sql).toContain(
      "SourcePolicyRevision_projectId_profileId_profileVersion_key",
    );
  });
});
