export type ReleaseBuildScannerId =
  | "secretScan"
  | "sast"
  | "vulnerabilities";

export type ReleaseBuildScannerProfile = {
  id: ReleaseBuildScannerId;
  executable: string;
  argvTemplate: readonly string[];
  toolVersion: string;
  rulesDigest: string;
  dataDigest?: string;
  dataUpdatedAt?: string;
};

export type RegisteredReleaseBuildProfile = {
  id: "controlled-local-acceptance-v2";
  profileVersion: 2;
  runnerVersion: string;
  externalRequiredChecks: 0;
  requiredIndependentApprovals: 1;
  highRiskPathPrefixes: readonly string[];
  packageManagers: Readonly<Partial<Record<"npm" | "pnpm" | "yarn", {
    executable: string;
    toolVersion: string;
  }>>>;
  scanners: readonly ReleaseBuildScannerProfile[];
};

const HIGH_RISK_PATHS = [
  ".github/workflows/",
  "apps/devpilot-api/prisma/migrations/",
  "docker-compose",
  "infra/",
  "scripts/deploy",
] as const;

const PROFILE: RegisteredReleaseBuildProfile = {
  id: "controlled-local-acceptance-v2",
  profileVersion: 2,
  runnerVersion: "release-build-runner-v2",
  externalRequiredChecks: 0,
  requiredIndependentApprovals: 1,
  highRiskPathPrefixes: HIGH_RISK_PATHS,
  packageManagers: {
    pnpm: { executable: "/usr/local/bin/pnpm", toolVersion: "8.12.0" },
  },
  scanners: [
    scanner("secretScan", "/usr/local/bin/gitleaks", "8.30.1", [
      "detect", "--source", "{checkoutRoot}", "--report-format", "json",
      "--report-path", "{reportPath}", "--redact", "--no-banner",
    ], "2399b6a4626e78d39182868729a96e145be65b087d807e4d6a5cd6db0946c8c6"),
    scanner("sast", "/usr/local/bin/semgrep", "1.172.0", [
      "scan", "--config", "/opt/devpilot/security/semgrep-rules",
      "--metrics", "off", "--disable-version-check",
      "--json", "--output", "{reportPath}", "{checkoutRoot}",
    ], "b7e483abf001c405a3e908251ff66cb198a26702aff5fe4c5f0c4b2fffec4919"),
    scanner("vulnerabilities", "/usr/local/bin/trivy", "0.73.0", [
      "fs", "--format", "json", "--output", "{reportPath}",
      "--cache-dir", "/opt/devpilot/security/trivy-cache",
      "--skip-db-update", "--skip-java-db-update", "--offline-scan",
      "--scanners", "vuln", "--exit-code", "1",
      "--severity", "HIGH,CRITICAL", "{checkoutRoot}",
    ], "e5c54b277db94d2973c2d4fdf68c94be8729a3d5fc2e48e7da04b6dacdf0bb71", {
      dataDigest: "e5c54b277db94d2973c2d4fdf68c94be8729a3d5fc2e48e7da04b6dacdf0bb71",
      dataUpdatedAt: "2026-08-11T01:05:09.651160722Z",
    }),
  ],
};

export function resolveRegisteredReleaseBuildProfile(id: string) {
  return id === PROFILE.id ? PROFILE : null;
}

function scanner(
  id: ReleaseBuildScannerId,
  executable: string,
  toolVersion: string,
  argvTemplate: readonly string[],
  rulesDigest: string,
  data: Pick<ReleaseBuildScannerProfile, "dataDigest" | "dataUpdatedAt"> = {},
): ReleaseBuildScannerProfile {
  return {
    id,
    executable,
    argvTemplate,
    toolVersion,
    rulesDigest,
    ...data,
  };
}
