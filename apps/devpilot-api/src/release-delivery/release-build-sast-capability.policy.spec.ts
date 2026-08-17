import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { evaluateReleaseBuildSastCapability,
  SAST_UNSUPPORTED_SOURCE_REASON } from "./release-build-sast-capability.policy";
import { scanSupervisorSource } from "./release-build-supervisor-security";
import type { WorkerSourceManifestEntry } from "./release-build-worker-source-manifest";

const profile = resolveRegisteredReleaseBuildProfile(
  "controlled-local-acceptance-v2",
)!;

describe("release build SAST capability", () => {
  it("accepts ordinary nested source paths", () => {
    expect(evaluateReleaseBuildSastCapability(profile.sastCapability, [
      entry("src/api/index.ts"), entry("Dockerfile"), entry("docs/readme.md"),
    ])).toEqual({ available: true });
  });

  it("rejects every unsupported extension case-insensitively", () => {
    expect(evaluateReleaseBuildSastCapability(profile.sastCapability, [
      entry("src/apex/Controller.CLS"), entry("nested/job.TrIgGeR"),
      entry("services/app.EX"), entry("services/mix/boot.ExS"),
    ])).toEqual({
      available: false,
      reasonCode: SAST_UNSUPPORTED_SOURCE_REASON,
      engine: "semgrep-oss-1.172.0",
      unsupportedExtensions: [".cls", ".ex", ".exs", ".trigger"],
    });
  });

  it("blocks before scanner reports, build workspace or artifacts exist", async () => {
    const scope = await mkdtemp(join(tmpdir(), "sast-capability-"));
    const trustedRoot = join(scope, "trusted");
    try {
      await expect(scanSupervisorSource({
        request: { sourceManifest: { entries: [entry("src/App.CLS")] } } as never,
        profile, sourceRoot: join(scope, "missing-source"), trustedRoot,
        commandPath: "/usr/bin:/bin", commandTimeoutMs: 1_000,
        cancelGraceMs: 50,
      })).rejects.toMatchObject({
        detail: {
          code: "BUILD_SAST_CAPABILITY_UNAVAILABLE",
          gateSummary: { security: { sast: {
            status: "unavailable",
            reasonCode: SAST_UNSUPPORTED_SOURCE_REASON,
          } } },
        },
      });
      await expect(access(trustedRoot)).rejects.toBeDefined();
    } finally {
      await rm(scope, { recursive: true, force: true });
    }
  });
});

function entry(path: string): WorkerSourceManifestEntry {
  return { path, mode: "100644", sizeBytes: 1, sha256: "a".repeat(64) };
}
