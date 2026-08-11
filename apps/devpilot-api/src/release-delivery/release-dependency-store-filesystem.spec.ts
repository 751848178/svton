import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDependencyStoreManifest,
  quarantineDependencyStore,
  verifyDependencyStore } from "./release-dependency-store-filesystem";

describe("immutable dependency store filesystem", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "dependency-store-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("verifies every store file and rejects content drift", async () => {
    await mkdir(join(root, "store", "v3", "files"), { recursive: true });
    const file = join(root, "store", "v3", "files", "package.json");
    await writeFile(file, "fixture");
    const manifest = await createDependencyStoreManifest({ ...identity(), pendingRoot: root });
    await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
    const owner = { uid: process.getuid!(), gid: process.getgid!() };
    if (owner.uid !== 0) await expect(verifyDependencyStore(root, manifest))
      .rejects.toThrow("invalid");
    await expect(verifyDependencyStore(root, manifest, owner)).resolves.toEqual(manifest);
    await writeFile(file, "tampered");
    await expect(verifyDependencyStore(root, manifest, owner)).rejects.toThrow("invalid");
  });

  it("rejects symlinks instead of following them", async () => {
    await mkdir(join(root, "store"));
    await writeFile(join(root, "outside"), "secret");
    await symlink(join(root, "outside"), join(root, "store", "link"));
    await expect(createDependencyStoreManifest({ ...identity(), pendingRoot: root }))
      .rejects.toThrow("invalid");
  });

  it("atomically quarantines a damaged target outside the active key", async () => {
    const target = join(root, "a".repeat(64));
    await mkdir(target);
    await writeFile(join(target, "tampered"), "bad");
    const quarantined = await quarantineDependencyStore(target);
    await expect(import("node:fs/promises").then(({ access }) => access(target)))
      .rejects.toThrow();
    expect(quarantined).toContain("/.quarantine/");
  });

  it("rejects a group-writable active store even for the trusted owner", async () => {
    await mkdir(join(root, "store"));
    const manifest = await createDependencyStoreManifest({ ...identity(), pendingRoot: root });
    await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
    await chmod(root, 0o770);
    await expect(verifyDependencyStore(root, manifest, {
      uid: process.getuid!(), gid: process.getgid!() })).rejects.toThrow("invalid");
  });
});

function identity() {
  return { combinationHash: "a".repeat(64), lockfileDigest: "b".repeat(64),
    profileId: "controlled-local-acceptance-v2", profileVersion: 6,
    profileSnapshotHash: "d".repeat(64), supplyChainDigest: "e".repeat(64),
    fetchImage: `registry.test/api@sha256:${"f".repeat(64)}`,
    jobImage: `registry.test/api@sha256:${"f".repeat(64)}`,
    pnpmVersion: "8.12.0", platformOs: "linux", platformArch: "arm64",
    platformAbi: "node20-modules-115", platformLibc: "glibc-debian-bookworm",
    registryPolicyDigest: "c".repeat(64) };
}
