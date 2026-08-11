import type { ReleaseBuildScannerId } from "./release-build-acceptance-profile";

export function validateReleaseScannerReport(
  scannerId: ReleaseBuildScannerId,
  value: unknown,
) {
  if (scannerId === "secretScan") {
    if (!Array.isArray(value)) return invalid("gitleaks_report_invalid");
    return { valid: true, findings: value.length, report: value } as const;
  }
  if (!isRecord(value)) return invalid(`${scannerId}_report_invalid`);
  if (scannerId === "sast") {
    if (!Array.isArray(value.results)) return invalid("semgrep_report_invalid");
    return {
      valid: true,
      findings: value.results.length,
      report: value,
    } as const;
  }
  if (!validTrivyEnvelope(value)) return invalid("trivy_report_invalid");
  if (value.Results === undefined)
    return { valid: true, findings: 0, report: value } as const;
  if (!Array.isArray(value.Results)) return invalid("trivy_report_invalid");
  let findings = 0;
  for (const result of value.Results) {
    if (!validTrivyResult(result)) return invalid("trivy_report_invalid");
    findings += Array.isArray(result.Vulnerabilities)
      ? result.Vulnerabilities.length : 0;
  }
  return { valid: true, findings, report: value } as const;
}

function validTrivyEnvelope(value: Record<string, unknown>) {
  const errors = value.Errors;
  return value.SchemaVersion === 2 &&
    nonempty(value.ArtifactName) && nonempty(value.ArtifactType) &&
    isRecord(value.Metadata) && emptyError(value.Error) &&
    (errors === undefined || (Array.isArray(errors) && errors.length === 0));
}

function validTrivyResult(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !nonempty(value.Target) || !nonempty(value.Class) ||
    !nonempty(value.Type)) return false;
  const findings = value.Vulnerabilities;
  return (findings === undefined || findings === null ||
    (Array.isArray(findings) && findings.every(isRecord)));
}

function emptyError(value: unknown) {
  return value === undefined || value === null || value === "";
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function invalid(reasonCode: string) {
  return { valid: false, reasonCode } as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
