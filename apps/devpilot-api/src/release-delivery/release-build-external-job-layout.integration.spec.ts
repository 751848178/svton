import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrokerJobLayout, transferBuildWorkspace } from "./release-build-worker-job-layout";

const describeRootLinux = process.platform === "linux" && process.getuid?.() === 0
  ? describe : describe.skip;

describeRootLinux("external OCI host job layout", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "oci-layout-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("keeps source and job identity root-owned while output is job-writable", async () => {
    const prepared = join(root, "prepared");
    await mkdir(prepared); await writeFile(join(prepared, "source.js"), "fixture");
    const layout = await createBrokerJobLayout({ root: join(root, "jobs"),
      buildRunId: "build_01234567", uid: 3_000, gid: 3_000, externalOci: true });
    const source = await transferBuildWorkspace({ source: prepared,
      workRoot: layout.workRoot, uid: 3_000, gid: 3_000, immutable: true });
    await expect(modeOwner(layout.jobRoot)).resolves.toEqual([0, 0, 0o711]);
    await expect(modeOwner(source)).resolves.toEqual([0, 0, 0o555]);
    await expect(modeOwner(join(source, "source.js"))).resolves.toEqual([0, 0, 0o444]);
    await expect(modeOwner(layout.artifactRoot)).resolves.toEqual([3_000, 3_000, 0o700]);
    await expect(asBroker(["-e", `require('fs').writeFileSync(${JSON.stringify(
      join(source, "source.js"))},'tamper')`])).rejects.toThrow("exited 1");
    await expect(asBroker(["-e", `require('fs').writeFileSync(${JSON.stringify(
      join(layout.artifactRoot, "result"))},'ok')`])).resolves.toBeUndefined();
  });
});

async function modeOwner(path: string) {
  const value = await stat(path);
  return [value.uid, value.gid, value.mode & 0o777];
}
function asBroker(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { uid: 3_000, gid: 3_000,
      stdio: ["ignore", "ignore", "ignore"] });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`exited ${code}`)));
  });
}
