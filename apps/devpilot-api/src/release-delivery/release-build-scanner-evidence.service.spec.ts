import { ConfigService } from "@nestjs/config";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { ReleaseBuildScannerEvidenceService } from "./release-build-scanner-evidence.service";
import { LocalReleaseEvidenceArtifactService } from "./local-release-evidence-artifact.service";

describe("ReleaseBuildScannerEvidenceService", () => {
  let scope: string;
  let checkout: string;
  let temporary: string;
  let executable: string;
  let service: ReleaseBuildScannerEvidenceService;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-scanner-spec-"));
    checkout = join(scope, "checkout");
    temporary = join(scope, "tmp");
    executable = join(scope, "fixture-scanner.mjs");
    await Promise.all([
      mkdir(checkout),
      mkdir(temporary),
      writeFile(executable, scannerSource(), { mode: 0o700 }),
    ]);
    await chmod(executable, 0o700);
    const artifacts = new LocalReleaseEvidenceArtifactService(
      new ConfigService({ RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts") }),
    );
    service = new ReleaseBuildScannerEvidenceService(artifacts);
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("runs registered scanners that really traverse the checkout", async () => {
    await writeFile(join(checkout, "safe.ts"), "export const safe = true;");
    const result = await service.execute(input(profile(executable)));
    expect(Object.values(result).map((item) => item.status)).toEqual([
      "passed", "passed", "passed",
    ]);
    expect(result.secretScan.identity).toMatchObject({
      sourceCommitSha: "a".repeat(40),
      buildRunId: "build-1",
      profileVersion: 2,
      exitCode: 0,
    });
  });

  it("blocks findings and redacts secret fields in the immutable report", async () => {
    await writeFile(join(checkout, "leak.ts"), "VULNERABLE raw-secret");
    const result = await service.execute(input(profile(executable)));
    expect(result.secretScan.status).toBe("failed");
    const filename = result.secretScan.evidenceRef!.split("/").at(-1)!;
    const stored = await readFile(
      join(scope, "artifacts/evidence/project-1/order-1/build-1", filename),
      "utf8",
    );
    expect(stored).not.toContain("raw-secret");
    expect(stored).toContain("[REDACTED]");
  });

  it("refuses a scanner report symlink instead of following it", async () => {
    const outside = join(scope, "outside.json");
    await writeFile(outside, "[]");
    await writeFile(executable, `#!/usr/bin/env node
import fs from "node:fs";
fs.symlinkSync(${JSON.stringify(outside)}, process.argv.at(-1));
`, { mode: 0o700 });
    const base = profile(executable);
    const fixture = { ...base, scanners: [base.scanners[0]] };
    const result = await service.execute(input(fixture));
    expect(result.secretScan).toMatchObject({
      status: "unavailable",
      reasonCode: "secretScan_report_missing",
    });
  });

  function input(profileValue: RegisteredReleaseBuildProfile) {
    return {
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
      sourceCommitSha: "a".repeat(40),
      sourceSnapshotDigest: "snapshot-digest",
      checkoutRoot: checkout,
      reportRoot: temporary,
      profile: profileValue,
      env: { PATH: process.env.PATH },
      timeoutMs: 5_000,
      cancelGraceMs: 50,
    };
  }
});

function profile(executable: string): RegisteredReleaseBuildProfile {
  const scanner = (id: "secretScan" | "sast" | "vulnerabilities") => ({
    id,
    executable,
    argvTemplate: [id, "{checkoutRoot}", "{reportPath}"],
    toolVersion: "fixture-v1",
    rulesDigest: `fixture-${id}-rules`,
  });
  return {
    id: "controlled-local-acceptance-v2",
    profileVersion: 2,
    runnerVersion: "fixture-runner-v1",
    externalRequiredChecks: 0,
    requiredIndependentApprovals: 1,
    highRiskPathPrefixes: [],
    packageManagers: {
      npm: { executable: "/missing/npm", toolVersion: "fixture" },
      pnpm: { executable: "/missing/pnpm", toolVersion: "fixture" },
      yarn: { executable: "/missing/yarn", toolVersion: "fixture" },
    },
    scanners: [scanner("secretScan"), scanner("sast"), scanner("vulnerabilities")],
  };
}

function scannerSource() {
  return `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const [kind, root, report] = process.argv.slice(2);
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(target) : [fs.readFileSync(target, "utf8")];
});
const found = walk(root).some((value) => value.includes("VULNERABLE"));
const finding = { RuleID: "fixture", Secret: "raw-secret" };
const output = kind === "secretScan" ? (found ? [finding] : [])
  : kind === "sast" ? { results: found ? [finding] : [] }
  : { Results: [{ Vulnerabilities: found ? [finding] : [] }] };
fs.writeFileSync(report, JSON.stringify(output));
process.exit(found ? 1 : 0);
`;
}
