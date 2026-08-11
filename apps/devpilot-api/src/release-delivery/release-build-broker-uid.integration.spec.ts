import { spawn } from "node:child_process";
import { chmod, chown, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brokerChildSpawnOptions } from "./release-build-broker-process";

const describeRootLinux = process.platform === "linux" && process.getuid?.() === 0
  ? describe : describe.skip;

describeRootLinux("release build real uid-3000 malicious boundary", () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "broker-uid-")); });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("denies supervisor secret, exchange, sibling, proc and signal access", async () => {
    const jobRoot = join(root, "jobs", "unguessable-current");
    const workRoot = join(jobRoot, "work");
    const control = join(jobRoot, "control");
    const sibling = join(root, "jobs", "unguessable-sibling");
    const exchange = join(root, "exchange");
    const secret = join(root, "worker.secret");
    await Promise.all([
      mkdir(workRoot, { recursive: true, mode: 0o700 }),
      mkdir(control, { mode: 0o755 }),
      mkdir(sibling, { mode: 0o700 }),
      mkdir(exchange, { mode: 0o750 }),
      writeFile(secret, "must-not-leak", { mode: 0o400 }),
    ]);
    await chownTree(jobRoot, 3_000, 3_000);
    await Promise.all([chown(sibling, 0, 0), chown(exchange, 2_000, 2_000),
      chown(secret, 0, 0), chmod(sibling, 0o700), chmod(exchange, 0o750)]);
    const script = join(control, "attack.cjs");
    await writeFile(script, attackSource({ secret, exchange, sibling }), { mode: 0o444 });
    await chown(control, 0, 0);
    await chown(script, 0, 0);
    const result = await execute(script, brokerOptions(jobRoot, workRoot));
    expect(result).toEqual({
      secret: false, exchange: false, sibling: false,
      supervisorProc: false, supervisorSignal: false, secretFd: false,
    });
  });
});

function brokerOptions(jobRoot: string, workRoot: string) {
  return brokerChildSpawnOptions({
    broker: {
      version: 1, request: { version: 1 } as never, jobRoot, workRoot,
      buildRoot: join(workRoot, "source"), artifactRoot: join(jobRoot, "raw"),
      supplyProofFile: join(jobRoot, "control/proof.json"),
      commandPath: "/usr/local/bin:/usr/bin:/bin",
      commandTimeoutMs: 1_000, cancelGraceMs: 50,
      prepared: { security: {}, sourceSnapshot: {
        sourceCommitSha: "a".repeat(40), treeHash: "tree", snapshotDigest: "snapshot",
      } },
    }, brokerUid: 3_000, brokerGid: 3_000,
  });
}

function execute(script: string, options: ReturnType<typeof brokerOptions>) {
  return new Promise<Record<string, boolean>>((resolve, reject) => {
    const child = spawn(process.execPath, [script], options);
    const output: Buffer[] = [];
    child.stdout!.on("data", (chunk: Buffer) => output.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => code === 0
      ? resolve(JSON.parse(Buffer.concat(output).toString("utf8")))
      : reject(new Error(`malicious child exited ${code}`)));
  });
}

async function chownTree(path: string, uid: number, gid: number) {
  await chown(path, uid, gid);
  await chmod(path, 0o700);
}

function attackSource(paths: { secret: string; exchange: string; sibling: string }) {
  return `const fs=require("node:fs");
const can=(fn)=>{try{fn();return true}catch{return false}};
const fds=can(()=>fs.readdirSync('/proc/self/fd'))?fs.readdirSync('/proc/self/fd'):[];
const fdTargets=fds.map(fd=>{try{return fs.readlinkSync('/proc/self/fd/'+fd)}catch{return ''}});
process.stdout.write(JSON.stringify({
 secret:can(()=>fs.readFileSync(${JSON.stringify(paths.secret)})),
 exchange:can(()=>fs.readdirSync(${JSON.stringify(paths.exchange)})),
 sibling:can(()=>fs.readdirSync(${JSON.stringify(paths.sibling)})),
 supervisorProc:can(()=>fs.readFileSync('/proc/'+process.ppid+'/environ')),
 supervisorSignal:can(()=>process.kill(process.ppid,0)),
 secretFd:fdTargets.some(value=>value.includes('worker.secret'))
}));`;
}
