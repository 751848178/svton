import { mkdtempSync, readFileSync, rmSync, symlinkSync,
  writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launcherControlsDigest, signLauncherProof, verifyLauncherProof } from "./release-build-launcher-proof.policy";

describe("external OCI launcher proof", () => {
  const roots: string[] = [];
  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

  it("requires a fresh signed exact-image heartbeat", () => {
    const fixture = proofFixture(Date.now());
    expect(verifyLauncherProof(fixture)).toBe(true);
    expect(verifyLauncherProof({ ...fixture,
      jobImage: `registry.test/api@sha256:${"b".repeat(64)}` })).toBe(false);
    expect(verifyLauncherProof({ ...fixture, now: Date.now() + 31_000 })).toBe(false);
  });

  it("rejects a mutable image and symlink proof", () => {
    const fixture = proofFixture(Date.now());
    expect(verifyLauncherProof({ ...fixture, jobImage: "registry.test/api:latest" })).toBe(false);
    const link = join(fixture.root, "proof-link.json");
    symlinkSync(fixture.proofFile!, link);
    expect(verifyLauncherProof({ ...fixture, proofFile: link })).toBe(false);
  });

  it("rejects a tampered engine evidence tuple", () => {
    const fixture = proofFixture(Date.now());
    const proof = JSON.parse(readFileSync(fixture.proofFile!, "utf8"));
    proof.dependencyNetworkMode = "docker-desktop-engine-proxy-v1";
    writeFileSync(fixture.proofFile!, JSON.stringify(proof), { mode: 0o600 });
    expect(verifyLauncherProof(fixture)).toBe(false);
  });

  function proofFixture(nowMs: number) {
    const root = mkdtempSync(join(tmpdir(), "launcher-proof-")); roots.push(root);
    const secretFile = join(root, "secret"); const proofFile = join(root, "proof.json");
    const secret = "launcher-proof-secret-at-least-32-bytes";
    const jobImage = `registry.test/api@sha256:${"a".repeat(64)}`;
    const now = new Date(nowMs).toISOString();
    writeFileSync(secretFile, secret, { mode: 0o600 });
    writeFileSync(proofFile, JSON.stringify(signLauncherProof({
      schemaVersion: 1, provider: "external-oci-launcher-v1",
      profileId: "controlled-local-acceptance-v2", jobImage,
      controlsDigest: launcherControlsDigest, launcherInstanceId: "launcher_instance_01",
      dependencyNetworkMode: "direct-public-dns-v1",
      engineEvidenceDigest: "b".repeat(64),
      startedAt: now, heartbeatAt: now,
    }, secret)), { mode: 0o600 });
    return { root, proofFile, secretFile, jobImage, now: nowMs };
  }
});
