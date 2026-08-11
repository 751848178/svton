import type { ReleaseBuildPackageEvidenceService } from "./release-build-package-evidence.service";
import type { ReleaseBuildScannerEvidenceService } from "./release-build-scanner-evidence.service";

const passed = {
  status: "passed",
  reasonCode: "fixture_passed",
  evidenceRef: "release-evidence://fixture/report.json",
  evidenceHash: "fixture-evidence-hash",
} as const;

export function releaseBuildEvidenceStubs() {
  const packages = {
    execute: jest.fn().mockResolvedValue({
      install: passed,
      tests: passed,
      quality: passed,
      logs: [],
    }),
  } as unknown as ReleaseBuildPackageEvidenceService;
  const scanners = {
    execute: jest.fn().mockResolvedValue({
      secretScan: passed,
      sast: passed,
      vulnerabilities: passed,
    }),
  } as unknown as ReleaseBuildScannerEvidenceService;
  return { packages, scanners };
}
