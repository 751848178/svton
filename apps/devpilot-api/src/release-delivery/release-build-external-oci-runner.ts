import { createHash } from "node:crypto";
import { chmod, chown, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReleaseBuildBrokerInput, ReleaseBuildBrokerResult } from "./release-build-filesystem-broker";
import type { ReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { assertDockerExecutable, assertExternalOciJob, assertLauncherLabel,
  dockerCreateArguments } from "./release-build-external-oci.policy";
import { runExternalOciCommand as command } from "./release-build-external-oci-command";

export async function runExternalOciBroker(input: {
  broker: ReleaseBuildBrokerInput;
  supplyProof: ReleaseBuildSupplyProof;
  image: string;
  dockerExecutable: string;
  launcherLabel: string;
  timeoutMs: number;
  signal?: AbortSignal;
}) {
  const controlRoot = join(input.broker.jobRoot, "control");
  const workRoot = join(input.broker.jobRoot, "container-work");
  await Promise.all([
    mkdir(controlRoot, { mode: 0o700 }),
    mkdir(workRoot, { mode: 0o700 }),
  ]);
  await chown(workRoot, 3_000, 3_000);
  const containerInput: ReleaseBuildBrokerInput = {
    ...input.broker, jobRoot: "/", workRoot: "/work", buildRoot: "/source",
    dependencyStoreRoot: "/dependency-store", artifactRoot: "/output",
    supplyProofFile: "/job/supply-proof.json",
  };
  await Promise.all([
    writeFile(join(controlRoot, "broker-input.json"), JSON.stringify(containerInput),
      { flag: "wx", mode: 0o444 }),
    writeFile(join(controlRoot, "supply-proof.json"), JSON.stringify(input.supplyProof),
      { flag: "wx", mode: 0o444 }),
  ]);
  await chmod(controlRoot, 0o555);
  const label = assertLauncherLabel(input.launcherLabel);
  const name = `dp-build-${createHash("sha256").update(
    `${label}:${input.broker.request.identity.jobId}`)
    .digest("hex").slice(0, 24)}`;
  const job = { name, launcherLabel: label, image: input.image, controlRoot,
    sourceRoot: input.broker.buildRoot,
    dependencyStoreRoot: input.broker.dependencyStoreRoot,
    workRoot, outputRoot: input.broker.artifactRoot };
  await assertExternalOciJob(job, input.broker.jobRoot);
  const executable = assertDockerExecutable(input.dockerExecutable);
  let createAttempted = false;
  try {
    createAttempted = true;
    await command(executable, dockerCreateArguments(job), 30_000);
    const output = await command(executable, ["start", "--attach", name],
      input.timeoutMs, input.signal);
    return parse(output.stdout);
  } finally {
    if (createAttempted) {
      await command(executable, ["kill", name], 15_000).catch(() => undefined);
      await command(executable, ["rm", "--force", name], 30_000);
    }
  }
}

export async function cleanupExternalOciLauncherContainers(input: {
  dockerExecutable: string;
  launcherLabel: string;
}) {
  const executable = assertDockerExecutable(input.dockerExecutable);
  const label = assertLauncherLabel(input.launcherLabel);
  const listed = await command(executable, ["ps", "--all", "--quiet", "--filter",
    `label=devpilot.release-build.launcher=${label}`], 30_000);
  const ids = listed.stdout.toString("utf8").split(/\s+/).filter(Boolean);
  if (ids.some((id) => !/^[a-f0-9]{12,64}$/.test(id)))
    throw new Error("OCI launcher returned an invalid stale container id");
  for (const id of ids) await command(executable, ["rm", "--force", id], 30_000);
  const networks = await command(executable, ["network", "ls", "--quiet", "--filter",
    `label=devpilot.release-build.launcher=${label}`], 30_000);
  const networkIds = networks.stdout.toString("utf8").split(/\s+/).filter(Boolean);
  if (networkIds.some((id) => !/^[a-f0-9]{12,64}$/.test(id)))
    throw new Error("OCI launcher returned an invalid stale network id");
  for (const id of networkIds)
    await command(executable, ["network", "rm", id], 30_000);
}

function parse(value: Buffer): ReleaseBuildBrokerResult {
  const parsed = JSON.parse(value.toString("utf8"));
  if (parsed?.version !== 1 || !["succeeded", "failed", "canceled"].includes(parsed.status))
    throw new Error("OCI broker returned invalid result");
  return parsed;
}
