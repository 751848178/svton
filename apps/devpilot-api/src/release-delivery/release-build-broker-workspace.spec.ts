import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWritableBrokerWorkspace } from "./release-build-broker-workspace";
import { runControlledBuildCommand } from "./release-build-command-runner";

describe("release build broker writable workspace", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "broker-workspace-")); });
  afterEach(async () => {
    await chmod(join(root, "source"), 0o700).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  });

  it("builds successfully in a writable copy without changing the scan source", async () => {
    const source = join(root, "source"); const work = join(root, "work");
    await Promise.all([mkdir(source), mkdir(work)]);
    await writeFile(join(source, "build.js"), [
      "const fs=require('node:fs');",
      "fs.mkdirSync('dist');",
      "fs.writeFileSync('dist/result.txt','success');",
    ].join("\n"));
    await chmod(join(source, "build.js"), 0o444); await chmod(source, 0o555);
    const build = await createWritableBrokerWorkspace(source, work);
    const result = await runControlledBuildCommand({ command: "node build.js", cwd: build,
      env: { PATH: process.env.PATH, HOME: work, TMPDIR: work }, timeoutMs: 5_000,
      cancelGraceMs: 50 });
    expect(result).toMatchObject({ kind: "completed", exitCode: 0 });
    await expect(readFile(join(build, "dist/result.txt"), "utf8")).resolves.toBe("success");
    await expect(readFile(join(source, "dist/result.txt"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects source/work overlap and source symlinks", async () => {
    const source = join(root, "source"); await mkdir(source);
    await expect(createWritableBrokerWorkspace(source, source)).rejects.toThrow("overlap");
    const work = join(root, "work"); await mkdir(work);
    await symlink("/etc/passwd", join(source, "escape"));
    await expect(createWritableBrokerWorkspace(source, work)).rejects.toThrow("unsupported");
  });
});
