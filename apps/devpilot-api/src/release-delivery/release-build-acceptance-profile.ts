import { RELEASE_DEPENDENCY_STORE_POLICY,
  type ReleaseDependencyStorePolicy } from "./release-dependency-store-profile";

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
  profileVersion: number;
  runnerVersion: string;
  externalRequiredChecks: number;
  requiredIndependentApprovals: number;
  highRiskPathPrefixes: readonly string[];
  sastCapability: ReleaseBuildSastCapability;
  dependencyStorePolicy: ReleaseDependencyStorePolicy;
  packageManagers: Readonly<Partial<Record<"npm" | "pnpm" | "yarn", {
    executable: string;
    pathExecutable?: string;
    executableDigest?: string;
    toolVersion: string;
  }>>>;
  scanners: readonly ReleaseBuildScannerProfile[];
  supplyChain: ReleaseBuildSupplyChain;
};

export type ReleaseBuildSastCapability = {
  engine: "semgrep-oss-1.172.0";
  rulePaths: readonly string[];
  unsupportedExtensions: readonly string[];
};

export type ReleaseBuildSupplyChain = {
  schemaVersion: 1;
  baseImageDigests: readonly string[];
  artifactDigests: Readonly<Record<string, string>>;
};

const HIGH_RISK_PATHS = [
  ".github/workflows/",
  "apps/devpilot-api/prisma/migrations/",
  "docker-compose",
  "infra/",
  "scripts/deploy",
] as const;

const SEMGREP_RULE_PATHS = [
  "ai", "bash", "c", "clojure", "csharp", "dockerfile",
  "generic", "go", "html", "java", "javascript", "json", "kotlin", "ocaml",
  "package_managers", "php", "problem-based-packs", "python", "ruby", "rust",
  "scala", "solidity", "swift", "terraform", "typescript", "yaml",
] as const;
const SEMGREP_CONFIG_ARGV = SEMGREP_RULE_PATHS.flatMap((path) => [
  "--config", `/opt/devpilot/security/semgrep-rules-manifest/${path}`,
]);

const PROFILE: RegisteredReleaseBuildProfile = {
  id: "controlled-local-acceptance-v2",
  profileVersion: 6,
  runnerVersion: "release-build-runner-v6",
  externalRequiredChecks: 0,
  requiredIndependentApprovals: 1,
  highRiskPathPrefixes: HIGH_RISK_PATHS,
  sastCapability: {
    engine: "semgrep-oss-1.172.0",
    rulePaths: SEMGREP_RULE_PATHS,
    unsupportedExtensions: [".cls", ".trigger", ".ex", ".exs"],
  },
  dependencyStorePolicy: RELEASE_DEPENDENCY_STORE_POLICY,
  packageManagers: {
    pnpm: {
      executable: "/opt/devpilot/pnpm/8.12.0/bin/pnpm.cjs",
      pathExecutable: "/usr/local/bin/pnpm",
      executableDigest:
        "sha256:4dc93970ff042377f241cd53d3ca8cb0b28939b878757526956ae95bbfdc0977",
      toolVersion: "8.12.0",
    },
  },
  scanners: [
    scanner("secretScan", "/usr/local/bin/gitleaks", "8.30.1", [
      "detect", "--source", "{checkoutRoot}", "--report-format", "json",
      "--report-path", "{reportPath}", "--redact", "--no-banner",
    ], "2399b6a4626e78d39182868729a96e145be65b087d807e4d6a5cd6db0946c8c6"),
    scanner("sast", "/usr/local/bin/semgrep", "1.172.0", [
      "scan", ...SEMGREP_CONFIG_ARGV,
      "--metrics", "off", "--disable-version-check",
      "--json", "--output", "{reportPath}", "{checkoutRoot}",
    ], "fd7c589911672528ba190da81f9d0777343bb5c2c8678e8810268afa5d97aca3"),
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
  supplyChain: {
    schemaVersion: 1,
    baseImageDigests: [
      "sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5",
      "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
      "sha256:abd67ffcfa541b485a3dff59865ab629aa048a6c613e639d36e7456b0b229241",
    ],
    artifactDigests: {
      pnpmPackage: "sha512:279278f83be782f6faaefbacbccc503301c4ec2cdafd40983e7c26aeeee7c38270f5c8e635b43464691b897abe1675b40c06df6edadde922532b7368aa9a5267",
      pnpmPathExecutable: "sha256:4dc93970ff042377f241cd53d3ca8cb0b28939b878757526956ae95bbfdc0977",
      semgrepRequirements: "sha256:278aedc50045986f04e0eb268e5e42883bed7bdf6bff64d08cc2ef455f0b334c",
      semgrepRules: "sha256:b7e483abf001c405a3e908251ff66cb198a26702aff5fe4c5f0c4b2fffec4919",
      semgrepRuleManifest: "sha256:50f2b21179f82f6c7248122df5a141974c14c3657965cfe9d7465eb0841179ae",
      trivyDatabase: "sha256:e5c54b277db94d2973c2d4fdf68c94be8729a3d5fc2e48e7da04b6dacdf0bb71",
      trivyDatabaseLayer: "sha256:4cdc607a113f80be2873b1dd3ebf08bc6f3d171e491dbee48dd2debe837aa848",
      gitleaksAmd64: "sha256:551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
      gitleaksArm64: "sha256:e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080",
      trivyAmd64: "sha256:2edd39da482bb4e9831962487b68f68e3928ec3137794757f54d00383d79547b",
      trivyArm64: "sha256:13833d97e8a1a5367471c372a173180157f593bece570e20d5d925fef552f5dd",
    },
  },
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
