import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { cpus, freemem } from "node:os";
import { statfs } from "node:fs/promises";
import { resolve } from "node:path";
import { SshTransportFactory } from "../common/ssh/ssh-transport.factory";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";
import type { PreparedReleaseDeploymentInput } from "./release-deployment-input.types";
import type { ReleaseStagingWorkloadSnapshot } from "./release-staging-workload.types";
import { isSafeReleaseDeploymentSshRoot } from "./release-deployment-ssh-target.utils";
import {
  ReleaseServerCapacityRepository,
  type CapacityEvidenceIdentity,
} from "./release-server-capacity.repository";

type Measurement = {
  cpuMillicores: number;
  memoryCapacityBytes: number;
  diskCapacityBytes: number;
  provider: string;
  targetRoot: string;
  fitPolicy: "local-single-tenant-acceptance-v1" | "ssh-capacity-baseline-v1";
};

@Injectable()
export class ReleaseServerCapacityService {
  private readonly localRoot: string;

  constructor(
    config: ConfigService,
    private readonly repository: ReleaseServerCapacityRepository,
    private readonly transports: SshTransportFactory,
  ) {
    this.localRoot = resolve(
      config.get<string>("RELEASE_STAGING_DEPLOYMENT_ROOT") ||
        `${process.cwd()}/storage/release-deployments`,
    );
  }

  async collect(input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    configRevisionId: string;
    buildRunId: string;
    manifestId: string;
    providerKey: string;
    deployment: PreparedReleaseDeploymentInput;
    workload: ReleaseStagingWorkloadSnapshot;
  }) {
    const requirements = aggregateRequirements(input.workload);
    if (!requirements) return null;
    const requirementHash = hashCanonicalReleaseValue(requirements);
    const identity = capacityIdentity(input, requirementHash);
    const reusable = await this.repository.findFresh(identity);
    if (reusable) return reusable;
    let measurement: Measurement | null = null;
    try {
      measurement = input.providerKey === "local-filesystem-v1"
        ? await this.localMeasurement()
        : input.providerKey === "ssh-v1"
          ? await this.sshMeasurement(input.deployment)
          : null;
    } catch {
      return null;
    }
    if (!measurement) return null;
    const measurementHash = hashCanonicalReleaseValue(measurement);
    const fit = measurement.fitPolicy === "local-single-tenant-acceptance-v1" &&
      requirements.cpuMillicores <= measurement.cpuMillicores &&
      requirements.memoryBytes <= measurement.memoryCapacityBytes &&
      requirements.diskBytes <= measurement.diskCapacityBytes;
    const sampledAt = new Date();
    return this.repository.create({
        ...identity,
        measurementHash,
        status: fit ? "fit" : "insufficient",
        requirements,
        measurement,
        reasonCode: fit ? "capacity_fit_local_single_tenant"
          : measurement.fitPolicy === "ssh-capacity-baseline-v1"
            ? "capacity_reservation_provider_missing"
            : "capacity_insufficient",
        sampledAt,
        expiresAt: new Date(sampledAt.getTime() + 5 * 60_000),
    });
  }

  findFresh(input: Parameters<ReleaseServerCapacityService["collect"]>[0]) {
    const requirements = aggregateRequirements(input.workload);
    return requirements
      ? this.repository.findFresh(capacityIdentity(
          input,
          hashCanonicalReleaseValue(requirements),
        ))
      : null;
  }

  private async localMeasurement(): Promise<Measurement> {
    const disk = await statfs(this.localRoot);
    return {
      cpuMillicores: cpus().length * 1_000,
      memoryCapacityBytes: freemem(),
      diskCapacityBytes: disk.bavail * disk.bsize,
      provider: "local-node-capacity-baseline-v1",
      targetRoot: this.localRoot,
      fitPolicy: "local-single-tenant-acceptance-v1",
    };
  }

  private async sshMeasurement(
    deployment: PreparedReleaseDeploymentInput,
  ): Promise<Measurement | null> {
    const target = deployment.targetConnection;
    if (!target || !isSafeReleaseDeploymentSshRoot(target.root)) return null;
    const transport = this.transports.create({
      host: target.host,
      port: target.port,
      username: target.username,
      ...(target.credential.includes("PRIVATE KEY")
        ? { privateKey: target.credential }
        : { password: target.credential }),
    });
    try {
      const result = await transport.execScript(
        SSH_CAPACITY_SCRIPT.replace("__TARGET_ROOT__", target.root), {
        timeoutMs: 15_000,
      });
      if (result.exitCode !== 0 || result.timedOut || result.cancelled) return null;
      return parseSshMeasurement(result.stdout);
    } finally {
      await transport.dispose?.();
    }
  }
}

const SSH_CAPACITY_SCRIPT = `set -eu
cpu_count="$(getconf _NPROCESSORS_ONLN)"
memory_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
target_root='__TARGET_ROOT__'
disk_kib="$(df -Pk -- "$target_root" | awk 'NR==2 {print $4}')"
printf 'CPU=%s\\nMEM_KIB=%s\\nDISK_KIB=%s\\nROOT=%s\\n' "$cpu_count" "$memory_kib" "$disk_kib" "$target_root"
`;

function aggregateRequirements(workload: ReleaseStagingWorkloadSnapshot) {
  if (workload.services.some((service) => !service.resources)) return null;
  return workload.services.reduce((sum, service) => ({
    cpuMillicores: sum.cpuMillicores + service.resources!.cpuMillicores,
    memoryBytes: sum.memoryBytes + service.resources!.memoryBytes,
    diskBytes: sum.diskBytes + service.resources!.diskBytes,
  }), { cpuMillicores: 0, memoryBytes: 0, diskBytes: 0 });
}

function parseSshMeasurement(stdout: string): Measurement | null {
  const values = Object.fromEntries(stdout.trim().split("\n").map((line) => line.split("=")));
  const cpu = Number(values.CPU);
  const memory = Number(values.MEM_KIB);
  const disk = Number(values.DISK_KIB);
  if (![cpu, memory, disk].every((value) => Number.isSafeInteger(value) && value > 0)) return null;
  const root = values.ROOT;
  if (!root || !isSafeReleaseDeploymentSshRoot(root)) return null;
  return { cpuMillicores: cpu * 1_000, memoryCapacityBytes: memory * 1_024,
    diskCapacityBytes: disk * 1_024, provider: "ssh-linux-capacity-baseline-v1",
    targetRoot: root, fitPolicy: "ssh-capacity-baseline-v1" };
}

function capacityIdentity(
  input: Parameters<ReleaseServerCapacityService["collect"]>[0],
  requirementHash: string,
): CapacityEvidenceIdentity {
  const { teamId, projectId, environmentId, configRevisionId, buildRunId,
    manifestId, providerKey } = input;
  return { teamId, projectId, environmentId, configRevisionId, buildRunId,
    manifestId, providerKey,
    bindingId: input.deployment.snapshot.target.bindingId,
    deploymentInputHash: input.deployment.snapshot.inputHash,
    workloadInputHash: input.workload.inputHash,
    requirementHash,
    sampledBucket: timeBucket(new Date(), 5 * 60_000) };
}

function timeBucket(now: Date, intervalMs: number) {
  return new Date(Math.floor(now.getTime() / intervalMs) * intervalMs);
}
