import { spawn, type SpawnOptions } from "node:child_process";
import { chmod, chown, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ReleaseBuildBrokerInput,
  ReleaseBuildBrokerResult,
} from "./release-build-filesystem-broker";
import type { ReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";

const MAX_RESULT_BYTES = 10 * 1024 * 1024;

export async function runReleaseBuildBrokerProcess(input: {
  broker: ReleaseBuildBrokerInput;
  supplyProof: ReleaseBuildSupplyProof;
  brokerUid: number;
  brokerGid: number;
  timeoutMs: number;
  signal?: AbortSignal;
}) {
  const control = join(input.broker.jobRoot, "control");
  await mkdir(control, { recursive: false, mode: 0o700 });
  const requestPath = join(control, "broker-input.json");
  const proofPath = join(control, "supply-proof.json");
  await writeFile(proofPath, JSON.stringify(input.supplyProof), {
    flag: "wx",
    mode: 0o444,
  });
  await writeFile(requestPath, JSON.stringify(input.broker), {
    flag: "wx",
    mode: 0o444,
  });
  await chmod(control, 0o555);
  await chown(control, 0, 0).catch(() => undefined);
  await chown(requestPath, 0, 0).catch(() => undefined);
  await chown(proofPath, 0, 0).catch(() => undefined);
  return spawnBroker(requestPath, input);
}

export function brokerChildSpawnOptions(input: {
  broker: ReleaseBuildBrokerInput;
  brokerUid: number;
  brokerGid: number;
}): SpawnOptions {
  return {
    cwd: input.broker.jobRoot,
    detached: true,
    uid: input.brokerUid,
    gid: input.brokerGid,
    shell: false,
    env: {
      NODE_ENV: "production",
      PATH: input.broker.commandPath,
      HOME: input.broker.workRoot,
      TMPDIR: join(input.broker.workRoot, "tmp"),
      LANG: "C.UTF-8",
    },
    stdio: ["ignore", "pipe", "pipe"],
  };
}

function spawnBroker(
  requestPath: string,
  input: Parameters<typeof runReleaseBuildBrokerProcess>[0],
) {
  return new Promise<ReleaseBuildBrokerResult>((resolve, reject) => {
    const executable = join(__dirname, "release-build-filesystem-broker.main.js");
    const child = spawn(process.execPath, [executable, requestPath],
      brokerChildSpawnOptions(input));
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let terminal = false;
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_RESULT_BYTES) terminate(new Error("broker output limit exceeded"));
      else target.push(chunk);
    };
    const terminate = (error: Error) => {
      if (terminal) return;
      terminal = true;
      killGroup(child.pid);
      reject(error);
    };
    child.stdout!.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr!.on("data", (chunk: Buffer) => collect(stderr, chunk));
    const timeout = setTimeout(
      () => terminate(new Error("broker timed out")),
      input.timeoutMs,
    );
    timeout.unref();
    const canceled = () => terminate(new Error("broker canceled"));
    input.signal?.addEventListener("abort", canceled, { once: true });
    child.once("error", terminate);
    child.once("close", (code) => {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", canceled);
      if (terminal) return;
      terminal = true;
      killGroup(child.pid);
      if (code !== 0) {
        reject(new Error(`broker failed: ${Buffer.concat(stderr).toString("utf8").slice(0, 500)}`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString("utf8")));
      } catch { reject(new Error("broker returned invalid JSON")); }
    });
  });
}

function killGroup(pid: number | undefined) {
  if (!pid) return;
  try { process.kill(-pid, "SIGKILL"); } catch { /* already exited */ }
}
