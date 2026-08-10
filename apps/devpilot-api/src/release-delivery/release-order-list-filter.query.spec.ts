import { releaseOrderListRowsQuery } from "./release-order-list.query";
import { escapeLikeLiteral } from "./release-order-list-filter.query";

describe("release order list SQL", () => {
  it.each([
    ["%", "=%"],
    ["_", "=_"],
    ["\\", "=\\"],
    ["=", "=="],
  ])("escapes %s as a literal LIKE character", (input, expected) => {
    expect(escapeLikeLiteral(input)).toBe(expected);
  });

  it("keeps one scoped predicate owner and exact read-model relations", () => {
    const sql = releaseOrderListRowsQuery({
      teamId: "team-1",
      projectId: "project-1",
      query: "Build #3",
      status: "building",
      take: 20,
    });
    const text = sql.strings.join("?");
    expect(text).toContain("dr.source = 'release_order'");
    expect(text).toContain("dr.dryRun = FALSE");
    expect(text).toContain("pe.baselineRole IN ('staging', 'production')");
    expect(text).toContain("pri.lockedAt IS NOT NULL");
    expect(text).toContain("rir.identityId = pri.id");
    expect(text).toContain("ORDER BY occurredAt DESC, tiePriority DESC");
    expect(text).not.toContain("GateEvaluation");
    expect(text).not.toContain("gitRepo");
    expect(text).not.toContain("logs");
    expect(sql.values).toEqual(
      expect.arrayContaining(["team-1", "project-1", 3, 20]),
    );
  });
});
