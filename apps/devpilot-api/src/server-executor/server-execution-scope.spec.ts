import { readExecutionScopeFromMetadata } from "./server-execution-scope";

describe("readExecutionScopeFromMetadata (P0-1 unified scope reader)", () => {
  it("reads standard flat projectId/environmentId", () => {
    expect(
      readExecutionScopeFromMetadata({
        projectId: "proj-1",
        environmentId: "env-1",
      }),
    ).toEqual({ projectId: "proj-1", environmentId: "env-1" });
  });

  it("reads legacy nested sourceMetadata.* (release-stage adapter data)", () => {
    expect(
      readExecutionScopeFromMetadata({
        sourceMetadata: {
          projectId: "proj-nested",
          environmentId: "env-nested",
          applicationId: "app-1",
        },
      }),
    ).toEqual({ projectId: "proj-nested", environmentId: "env-nested" });
  });

  it("prefers flat top-level over nested sourceMetadata", () => {
    expect(
      readExecutionScopeFromMetadata({
        projectId: "proj-flat",
        environmentId: "env-flat",
        sourceMetadata: { projectId: "proj-nested", environmentId: "env-nested" },
      }),
    ).toEqual({ projectId: "proj-flat", environmentId: "env-flat" });
  });

  it("returns nulls when no scope present (team-global only)", () => {
    expect(readExecutionScopeFromMetadata({})).toEqual({
      projectId: null,
      environmentId: null,
    });
  });

  it("ignores blank/whitespace strings", () => {
    expect(
      readExecutionScopeFromMetadata({ projectId: "   ", environmentId: "" }),
    ).toEqual({ projectId: null, environmentId: null });
  });

  it("handles non-object / array / null metadata safely", () => {
    expect(readExecutionScopeFromMetadata(null)).toEqual({
      projectId: null,
      environmentId: null,
    });
    expect(readExecutionScopeFromMetadata("string")).toEqual({
      projectId: null,
      environmentId: null,
    });
    expect(readExecutionScopeFromMetadata([])).toEqual({
      projectId: null,
      environmentId: null,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(
      readExecutionScopeFromMetadata({ projectId: "  proj-1  " }),
    ).toEqual({ projectId: "proj-1", environmentId: null });
  });

  // 线上真实形状：server-executor 持久化层把 metadata 再包一层 sourceMetadata，
  // 故 projectId 落在 metadata.sourceMetadata.sourceMetadata.projectId。
  // 旧 reader 只读一层 → 命不中 → 项目模板永远不匹配（线上 P0-1 真实根因）。
  it("reads double-wrapped sourceMetadata (job-persistence re-wrap)", () => {
    expect(
      readExecutionScopeFromMetadata({
        sourceMetadata: {
          releasePlanId: "plan-1",
          sourceMetadata: {
            projectId: "proj-1",
            environmentId: "env-1",
            applicationId: "app-1",
          },
          businessRunSync: "release_stage",
        },
      }),
    ).toEqual({ projectId: "proj-1", environmentId: "env-1" });
  });

  it("reads environmentId from inner sourceMetadata when only env nested twice", () => {
    expect(
      readExecutionScopeFromMetadata({
        sourceMetadata: { sourceMetadata: { environmentId: "env-deep" } },
      }),
    ).toEqual({ projectId: null, environmentId: "env-deep" });
  });
});
