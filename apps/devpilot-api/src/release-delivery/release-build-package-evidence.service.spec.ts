import { ConfigService } from "@nestjs/config";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { ReleaseBuildPackageEvidenceService } from "./release-build-package-evidence.service";
import { LocalReleaseEvidenceArtifactService } from "./local-release-evidence-artifact.service";

describe("ReleaseBuildPackageEvidenceService", () => {
  let scope: string;
  let checkout: string;
  let pnpm: string;
  let service: ReleaseBuildPackageEvidenceService;

  beforeEach(async () => {
    scope = await mkdtemp(join(tmpdir(), "release-package-evidence-"));
    checkout = join(scope, "checkout");
    await mkdir(join(checkout, "scripts"), { recursive: true });
    pnpm = await resolveExecutable("pnpm");
    const artifacts = new LocalReleaseEvidenceArtifactService(
      new ConfigService({ RELEASE_BUILD_ARTIFACT_ROOT: join(scope, "artifacts") }),
    );
    service = new ReleaseBuildPackageEvidenceService(artifacts);
  });

  afterEach(async () => rm(scope, { recursive: true, force: true }));

  it("runs locked install, tests, lint and typecheck in the real work volume", async () => {
    await fixture(["test", "lint", "typecheck"]);
    const result = await service.execute(input());
    expect(result.install.status).toBe("passed");
    expect(result.tests.status).toBe("passed");
    expect(result.quality.status).toBe("passed");
    expect(result.install.evidenceRef).toContain("release-evidence://build-1/");
  }, 20_000);

  it("keeps an absent quality command unavailable", async () => {
    await fixture(["test", "typecheck"]);
    const result = await service.execute(input());
    expect(result.quality).toMatchObject({
      status: "unavailable",
      reasonCode: "lint_not_configured",
    });
  }, 20_000);

  async function fixture(scripts: string[]) {
    const scriptMap = Object.fromEntries(
      scripts.map((name) => [name, `node scripts/verify.mjs ${name}`]),
    );
    await Promise.all([
      writeFile(
        join(checkout, "package.json"),
        JSON.stringify({ name: "fixture", private: true, scripts: scriptMap }),
      ),
      writeFile(join(checkout, "pnpm-lock.yaml"), "lockfileVersion: '6.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\n"),
      writeFile(join(checkout, "source.ts"), "export const value: number = 1;\n"),
      writeFile(
        join(checkout, "scripts/verify.mjs"),
        "import fs from 'node:fs'; const source=fs.readFileSync('source.ts','utf8'); if(!source.includes('number = 1')) process.exit(1);",
      ),
    ]);
  }

  function input() {
    return {
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "build-1",
      sourceCommitSha: "b".repeat(40),
      checkoutRoot: checkout,
      components: [{
        key: "component-1",
        name: "fixture",
        workingDirectory: ".",
        buildCommand: "node scripts/verify.mjs build",
        artifactOutputs: ["dist"],
        buildEnvironment: {},
      }],
      profile: profile(pnpm),
      env: { PATH: process.env.PATH, CI: "true" },
      timeoutMs: 10_000,
      cancelGraceMs: 50,
    };
  }
});

function profile(pnpm: string): RegisteredReleaseBuildProfile {
  return {
    id: "controlled-local-acceptance-v2",
    profileVersion: 2,
    runnerVersion: "fixture",
    externalRequiredChecks: 0,
    requiredIndependentApprovals: 1,
    highRiskPathPrefixes: [],
    packageManagers: {
      npm: { executable: pnpm, toolVersion: "fixture" },
      pnpm: { executable: pnpm, toolVersion: "fixture" },
      yarn: { executable: pnpm, toolVersion: "fixture" },
    },
    scanners: [],
  };
}

async function resolveExecutable(name: string) {
  for (const root of (process.env.PATH || "").split(delimiter)) {
    const path = join(root, name);
    try { await access(path, constants.X_OK); return path; } catch { /* next */ }
  }
  throw new Error(`${name} executable missing from test PATH`);
}
