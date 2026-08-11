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
  if (!Array.isArray(value.Results)) return invalid("trivy_report_invalid");
  const findings = value.Results.reduce((count, result) => {
    if (!isRecord(result) || !Array.isArray(result.Vulnerabilities)) return count;
    return count + result.Vulnerabilities.length;
  }, 0);
  return { valid: true, findings, report: value } as const;
}

function invalid(reasonCode: string) {
  return { valid: false, reasonCode } as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
