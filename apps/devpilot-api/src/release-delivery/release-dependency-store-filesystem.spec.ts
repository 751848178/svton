import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDependencyStoreManifest,
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
    await expect(verifyDependencyStore(root, manifest)).resolves.toEqual(manifest);
    await writeFile(file, "tampered");
    await expect(verifyDependencyStore(root, manifest)).rejects.toThrow("invalid");
  });

  it("rejects symlinks instead of following them", async () => {
    await mkdir(join(root, "store"));
    await writeFile(join(root, "outside"), "secret");
    await symlink(join(root, "outside"), join(root, "store", "link"));
    await expect(createDependencyStoreManifest({ ...identity(), pendingRoot: root }))
      .rejects.toThrow("invalid");
  });
});

function identity() {
  return { combinationHash: "a".repeat(64), lockfileDigest: "b".repeat(64),
    profileId: "controlled-local-acceptance-v2", profileVersion: 6,
    pnpmVersion: "8.12.0", platformOs: "linux", platformArch: "arm64",
    registryPolicyDigest: "c".repeat(64) };
}
