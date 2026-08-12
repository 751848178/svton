import { validateReleaseScannerReport } from "./release-build-scanner-report.policy";

describe("release scanner report policy", () => {
  it.each([
    { results: [] },
    { results: [], errors: [] },
  ])("accepts Semgrep only with no reported errors", (report) => {
    expect(validateReleaseScannerReport("sast", report))
      .toMatchObject({ valid: true, findings: 0 });
  });

  it.each([
    { results: [], errors: [{ message: "InvalidRuleSchemaError" }] },
    { results: [], errors: null },
  ])("rejects error-bearing or malformed Semgrep reports", (report) => {
    expect(validateReleaseScannerReport("sast", report)).toEqual({
      valid: false, reasonCode: "semgrep_report_invalid",
    });
  });

  it("accepts the real Trivy 0.73 repository shape with omitted Results", () => {
    const report = envelope(false);
    expect(validateReleaseScannerReport("vulnerabilities", report)).toEqual({
      valid: true, findings: 0, report,
    });
  });

  it("counts only well-formed Trivy vulnerability results", () => {
    const report = { ...envelope(), Results: [{ Target: "pnpm-lock.yaml",
      Class: "lang-pkgs", Type: "pnpm", Vulnerabilities: [{ VulnerabilityID: "CVE-1" }] }] };
    expect(validateReleaseScannerReport("vulnerabilities", report))
      .toMatchObject({ valid: true, findings: 1 });
  });

  it.each([
    {},
    { ...envelope(), SchemaVersion: "2" },
    { ...envelope(), SchemaVersion: 3 },
    { ...envelope(), ArtifactName: "" },
    { ...envelope(), Results: [], Metadata: undefined },
    { ...envelope(), Results: [], Metadata: [] },
    { ...envelope(), Error: "database failure" },
    { ...envelope(), Errors: [{ message: "failure" }] },
    { ...envelope(), Results: {} },
    { ...envelope(), Results: [{}] },
    { ...envelope(), Results: [{ Target: "lock", Class: "lang-pkgs",
      Type: "pnpm", Vulnerabilities: ["malformed"] }] },
  ])("rejects malformed or error-bearing Trivy reports", (report) => {
    expect(validateReleaseScannerReport("vulnerabilities", report)).toEqual({
      valid: false, reasonCode: "trivy_report_invalid",
    });
  });
});

function envelope(metadata = true) {
  return { SchemaVersion: 2, ArtifactName: "/workspace", ArtifactType: "repository",
    ...(metadata ? { Metadata: { Branch: "main", Commit: "a".repeat(40) } } : {}) };
}
