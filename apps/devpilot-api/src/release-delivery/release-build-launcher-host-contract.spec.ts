import { chmod, chown, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertReleaseBuildLauncherHostContract } from "./release-build-launcher-host-contract";

describe("release build launcher host contract", () => {
  let root: string;
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "launcher-host-")));
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("accepts distinct pre-provisioned paths owned by the launcher", async () => {
    const paths = await fixture();
    await expect(assertReleaseBuildLauncherHostContract(paths, process.getuid?.() ?? 0))
      .resolves.toEqual(expect.objectContaining({ inputRoot: paths.inputRoot }));
  });

  it("rejects a symlink and group-writable contract path", async () => {
    const paths = await fixture();
    const link = join(root, "proof-link"); await symlink(paths.proofFile, link);
    await expect(assertReleaseBuildLauncherHostContract({ ...paths, proofFile: link },
      process.getuid?.() ?? 0)).rejects.toThrow("symlink");
    await chmod(paths.secretFile, 0o620);
    await expect(assertReleaseBuildLauncherHostContract(paths, process.getuid?.() ?? 0))
      .rejects.toThrow("owner or mode");
  });

  it("rejects nested exchange roots", async () => {
    const paths = await fixture();
    const nested = join(paths.inputRoot, "nested"); await mkdir(nested, { mode: 0o700 });
    await expect(assertReleaseBuildLauncherHostContract({ ...paths, outputRoot: nested },
      process.getuid?.() ?? 0)).rejects.toThrow("overlap");
  });

  it("rejects a group-writable host tool", async () => {
    const paths = await fixture();
    await chmod(paths.toolExecutables[0], 0o720);
    await expect(assertReleaseBuildLauncherHostContract(paths, process.getuid?.() ?? 0))
      .rejects.toThrow("owner or mode");
  });

  it("rejects an unsafe relative tool override", async () => {
    const paths = await fixture();
    await expect(assertReleaseBuildLauncherHostContract({ ...paths,
      toolExecutables: ["bin/tar"] }, process.getuid?.() ?? 0))
      .rejects.toThrow("must be absolute");
  });

  it("rejects a symlinked tool override", async () => {
    const paths = await fixture();
    const link = join(root, "tool-link");
    await symlink(paths.toolExecutables[0], link);
    await expect(assertReleaseBuildLauncherHostContract({ ...paths,
      toolExecutables: [link] }, process.getuid?.() ?? 0))
      .rejects.toThrow("symlink");
  });

  const itRoot = process.getuid?.() === 0 ? it : it.skip;
  itRoot("rejects a non-root-owned host tool", async () => {
    const paths = await fixture();
    await chown(paths.toolExecutables[0], 3_000, 3_000);
    await expect(assertReleaseBuildLauncherHostContract(paths, 0))
      .rejects.toThrow("owner or mode");
  });

  async function fixture() {
    const directories = ["input", "output", "work"]
      .map((name) => join(root, name));
    await Promise.all(directories.map((path) => mkdir(path, { mode: 0o700 })));
    const files = ["proof", "secret", "supply", "docker", "scanner"]
      .map((name) => join(root, name));
    await Promise.all(files.map((path) => writeFile(path, "fixture", { mode: 0o600 })));
    await Promise.all([chmod(files[3], 0o700), chmod(files[4], 0o700)]);
    return { inputRoot: directories[0], outputRoot: directories[1],
      workRoot: directories[2], proofFile: files[0], secretFile: files[1],
      supplyProofFile: files[2], dockerExecutable: files[3], toolExecutables: [files[4]] };
  }
});
