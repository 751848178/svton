import {
  readProjectSourceBranch,
  resolveReleaseBranch,
} from "./release-branch-resolution.utils";

describe("resolveReleaseBranch", () => {
  it("uses explicit branch when provided", () => {
    const r = resolveReleaseBranch({ explicitBranch: "master", projectBranch: "master" });
    expect(r.resolvedBranch).toBe("master");
    expect(r.resolvedFromProject).toBe(false);
    expect(r.warnings).toEqual([]);
  });

  it("inherits project config branch when explicit is missing", () => {
    const r = resolveReleaseBranch({ explicitBranch: undefined, projectBranch: "master" });
    expect(r.resolvedBranch).toBe("master");
    expect(r.resolvedFromProject).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("warns when explicit branch differs from project config branch", () => {
    const r = resolveReleaseBranch({ explicitBranch: "develop", projectBranch: "master" });
    expect(r.resolvedBranch).toBe("develop");
    expect(r.resolvedFromProject).toBe(false);
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toContain("develop");
    expect(r.warnings[0]).toContain("master");
  });

  it("returns undefined branch with warning when neither explicit nor project branch", () => {
    const r = resolveReleaseBranch({ explicitBranch: undefined, projectBranch: undefined });
    expect(r.resolvedBranch).toBeUndefined();
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toContain("未配置发布分支");
  });

  it("treats blank/whitespace strings as missing", () => {
    const r = resolveReleaseBranch({ explicitBranch: "   ", projectBranch: "master" });
    expect(r.resolvedBranch).toBe("master");
    expect(r.resolvedFromProject).toBe(true);
  });

  it("never falls back to a hardcoded main/master", () => {
    const r = resolveReleaseBranch({ explicitBranch: undefined, projectBranch: undefined });
    // 关键：不得静默使用 main/master
    expect(r.resolvedBranch).not.toBe("main");
    expect(r.resolvedBranch).not.toBe("master");
  });
});

describe("readProjectSourceBranch", () => {
  it("reads config.source.branch", () => {
    expect(readProjectSourceBranch({ source: { branch: "master" } })).toBe("master");
  });

  it("returns undefined when source missing", () => {
    expect(readProjectSourceBranch({})).toBeUndefined();
    expect(readProjectSourceBranch(null)).toBeUndefined();
    expect(readProjectSourceBranch(undefined)).toBeUndefined();
  });

  it("returns undefined when source.branch missing or blank", () => {
    expect(readProjectSourceBranch({ source: {} })).toBeUndefined();
    expect(readProjectSourceBranch({ source: { branch: "  " } })).toBeUndefined();
  });
});
