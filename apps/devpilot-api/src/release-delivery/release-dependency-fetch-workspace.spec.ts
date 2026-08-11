import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDependencyFetchWorkspace, DEPENDENCY_FETCH_PACKAGE_DIGEST,
  DEPENDENCY_FETCH_PACKAGE_JSON, dependencyFetchArgv,
} from "./release-dependency-fetch-workspace";

describe("dependency fetch private workspace", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "dep-fetch-work-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("copies only verified regular control files into a writable workspace", async () => {
    const control = join(root, "control");
    const temporary = join(root, "tmp");
    await Promise.all([mkdir(control), mkdir(temporary)]);
    const lock = Buffer.from("lockfileVersion: '6.0'\npackages: {}\n");
    await Promise.all([
      writeFile(join(control, "package.json"), DEPENDENCY_FETCH_PACKAGE_JSON),
      writeFile(join(control, "pnpm-lock.yaml"), lock),
      writeFile(join(control, "untrusted.txt"), "must-not-copy"),
    ]);
    const workspace = await createDependencyFetchWorkspace({ controlRoot: control,
      temporaryRoot: temporary, packageDigest: DEPENDENCY_FETCH_PACKAGE_DIGEST,
      lockfileDigest: sha256(lock) });
    await expect(readFile(join(workspace.root, "package.json")))
      .resolves.toEqual(DEPENDENCY_FETCH_PACKAGE_JSON);
    await expect(readFile(join(workspace.root, "pnpm-lock.yaml")))
      .resolves.toEqual(lock);
    await expect(readFile(join(workspace.root, "untrusted.txt"))).rejects
      .toMatchObject({ code: "ENOENT" });
    await workspace.cleanup();
    await expect(readFile(workspace.root)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects symlinked control input and never fetches against /job", async () => {
    const control = join(root, "control");
    const temporary = join(root, "tmp");
    await Promise.all([mkdir(control), mkdir(temporary)]);
    await writeFile(join(root, "outside"), DEPENDENCY_FETCH_PACKAGE_JSON);
    await symlink(join(root, "outside"), join(control, "package.json"));
    await writeFile(join(control, "pnpm-lock.yaml"), "lockfileVersion: '6.0'\n");
    await expect(createDependencyFetchWorkspace({ controlRoot: control,
      temporaryRoot: temporary, packageDigest: DEPENDENCY_FETCH_PACKAGE_DIGEST,
      lockfileDigest: "0".repeat(64) })).rejects.toBeDefined();
    const args = dependencyFetchArgv("/tmp/dependency-fetch-Ab12x9");
    expect(args).toContain("--dir=/tmp/dependency-fetch-Ab12x9");
    expect(args).not.toContain("--dir=/job");
  });
});

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
