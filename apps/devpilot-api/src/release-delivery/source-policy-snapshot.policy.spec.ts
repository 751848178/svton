import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import {
  buildSourcePolicySnapshot,
  sourcePolicySnapshotHash,
} from "./source-policy-snapshot.policy";

describe("source policy canonical snapshot", () => {
  it("normalizes set-like collections but preserves argv order", () => {
    const first = profile();
    const reordered: RegisteredReleaseBuildProfile = {
      ...first,
      highRiskPathPrefixes: [...first.highRiskPathPrefixes].reverse(),
      scanners: [...first.scanners].reverse(),
    };
    expect(sourcePolicySnapshotHash(buildSourcePolicySnapshot(first))).toBe(
      sourcePolicySnapshotHash(buildSourcePolicySnapshot(reordered)),
    );

    const changedArgv: RegisteredReleaseBuildProfile = {
      ...first,
      scanners: first.scanners.map((scanner, index) => index === 0
        ? { ...scanner, argvTemplate: [...scanner.argvTemplate].reverse() }
        : scanner),
    };
    expect(sourcePolicySnapshotHash(buildSourcePolicySnapshot(changedArgv)))
      .not.toBe(sourcePolicySnapshotHash(buildSourcePolicySnapshot(first)));
  });

  it("binds the full executable, tool, rules and approval policy", () => {
    const snapshot = buildSourcePolicySnapshot(profile());
    expect(snapshot).toMatchObject({
      schemaVersion: 2,
      runnerVersion: "runner-v2",
      workerControls: {
        contractVersion: "release-build-untrusted-worker-v1",
        provider: "external-oci-launcher-v1",
        sourceArchive: "git-archive-exact-commit-v1",
        sourceManifest: "path-mode-size-sha256-v1",
        networkPolicy: "none",
        packageInstallPolicy: "locked-offline",
      },
      externalRequiredChecks: 0,
      requiredIndependentApprovals: 2,
      scanners: [{
        id: "secretScan",
        executable: "/opt/bin/scanner",
        toolVersion: "1.2.3",
        rulesDigest: "rules-sha",
      }],
    });
  });
});

function profile(): RegisteredReleaseBuildProfile {
  return {
    id: "controlled-local-acceptance-v2",
    profileVersion: 2,
    runnerVersion: "runner-v2",
    externalRequiredChecks: 0,
    requiredIndependentApprovals: 2,
    highRiskPathPrefixes: ["z/", "a/"],
    packageManagers: {
      pnpm: { executable: "/opt/bin/pnpm", toolVersion: "8.12.0" },
    },
    scanners: [{
      id: "secretScan",
      executable: "/opt/bin/scanner",
      argvTemplate: ["scan", "{checkoutRoot}"],
      toolVersion: "1.2.3",
      rulesDigest: "rules-sha",
    }],
    supplyChain: {
      schemaVersion: 1,
      baseImageDigests: ["sha256:base"],
      artifactDigests: { scanner: "sha256:scanner" },
    },
  };
}
