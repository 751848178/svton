import { createHash } from "node:crypto";
import { resolveRegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { evaluateReleaseDependencyLock } from "./release-dependency-lock.policy";
import type { WorkerSourceManifest } from "./release-build-worker-source-manifest";

const profile = resolveRegisteredReleaseBuildProfile(
  "controlled-local-acceptance-v2",
)!;

describe("release dependency lock policy", () => {
  it("accepts a public registry lock and binds all immutable inputs", () => {
    const first = evaluateReleaseDependencyLock(fixture(lock()));
    expect(first).toMatchObject({ allowed: true,
      lockfileDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      combinationHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const changed = evaluateReleaseDependencyLock(fixture(lock(), {
      ...profile, profileVersion: profile.profileVersion + 1,
    }));
    expect(changed.allowed && first.allowed && changed.combinationHash)
      .not.toBe(first.allowed && first.combinationHash);
  });

  it("allows local workspace specifiers without fetching them", () => {
    expect(evaluateReleaseDependencyLock(fixture(
      `${lock()}\nspecifiers:\n  local: workspace:*\n`,
    ))).toMatchObject({ allowed: true });
  });

  it.each([
    ["project_npmrc_forbidden", lock(), [".npmrc"]],
    ["dependency_protocol_forbidden", `${lock()}\nresolution:\n  repo: git+https://example/x.git\n`, []],
    ["dependency_protocol_forbidden", `${lock()}\nresolution:\n  path: file:../x\n`, []],
    ["dependency_protocol_forbidden", `${lock()}\nresolution:\n  path: link:../x\n`, []],
    ["dependency_registry_host_forbidden",
      `${lock()}\nresolution:\n  tarball: https://example.test/pkg.tgz\n`, []],
    ["dependency_auth_forbidden", `${lock()}\n_authToken: secret\n`, []],
    ["dependency_registry_host_forbidden",
      `${lock()}\nresolution:\n  tarball: \"https:\\u002f\\u002fevil.test/pkg.tgz\"\n`, []],
    ["dependency_protocol_forbidden",
      `${lock()}\nresolution:\n  tarball: //registry.npmjs.org/pkg.tgz\n`, []],
    ["dependency_auth_forbidden",
      `${lock()}\nresolution:\n  tarball: https://u:p@registry.npmjs.org/pkg.tgz\n`, []],
  ])("blocks %s before fetch", (detailCode, value, extra) => {
    expect(evaluateReleaseDependencyLock(fixture(value, profile, extra)))
      .toMatchObject({ allowed: false, detailCode });
  });

  it("rejects bytes that do not match the signed manifest", () => {
    const input = fixture(lock());
    input.bytes = Buffer.from(`${lock()}# drift\n`);
    expect(evaluateReleaseDependencyLock(input))
      .toMatchObject({ allowed: false, detailCode: "signed_lockfile_identity_invalid" });
  });
});

function lock() { return "lockfileVersion: '6.0'\npackages: {}\n"; }
function fixture(value: string, profileValue = profile, extra: string[] = []) {
  const bytes = Buffer.from(value);
  const entry = { path: "pnpm-lock.yaml", mode: "100644" as const,
    sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  const manifest = { version: 1 as const, entries: [entry, ...extra.map((path) =>
    ({ path, mode: "100644" as const, sizeBytes: 0, sha256: "0".repeat(64) }))],
    digest: "f".repeat(64) } satisfies WorkerSourceManifest;
  return { manifest, bytes, profile: profileValue, platformArch: "arm64" as const,
    jobImage: `registry.test/api@sha256:${"7".repeat(64)}` };
}
