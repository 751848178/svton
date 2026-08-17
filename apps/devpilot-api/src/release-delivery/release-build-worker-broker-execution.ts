import { join } from "node:path";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import { runReleaseBuildBrokerProcess } from "./release-build-broker-process";
import { runExternalOciBroker } from "./release-build-external-oci-runner";
import { promoteBrokerArtifacts } from "./release-build-broker-artifact-promoter";
import { expectedReleaseBuildSupplyProof } from "./release-build-supply-proof.policy";
import { materializeWorkerDependency, prepareWorkerBrokerRoots,
} from "./release-build-worker-preparation";
import type { prepareWorkerDependency, prepareWorkerScan,
} from "./release-build-worker-preparation";
import type { AssignedReleaseBuildWorkerRequest } from "./release-build-worker-stage-envelope.policy";
import { createBrokerJobLayout } from "./release-build-worker-job-layout";

export async function executeAssignedWorkerBuild(input: {
  request: AssignedReleaseBuildWorkerRequest;
  profile: RegisteredReleaseBuildProfile;
  scanned: Awaited<ReturnType<typeof prepareWorkerScan>>;
  dependency: Awaited<ReturnType<typeof prepareWorkerDependency>>;
  dependencyStore: { storeDigest: string };
  config: { workRoot: string; outputRoot: string; commandPath: string;
    commandTimeoutMs: number; cancelGraceMs: number; brokerUid: number;
    brokerGid: number; externalOci?: { image: string; dockerExecutable: string;
      launcherLabel: string } };
  signal: AbortSignal;
}) {
  const broker = await createBrokerJobLayout({
    root: join(input.config.workRoot, "broker-jobs"),
    buildRunId: input.request.identity.buildRunId,
    uid: input.config.brokerUid, gid: input.config.brokerGid,
    externalOci: Boolean(input.config.externalOci),
  });
  try {
    const roots = await prepareWorkerBrokerRoots({ scanned: input.scanned,
      dependency: input.dependency, broker, uid: input.config.brokerUid,
      gid: input.config.brokerGid, immutable: Boolean(input.config.externalOci) });
    const brokerInput: Parameters<typeof runReleaseBuildBrokerProcess>[0] = {
      broker: { version: 1, request: materializeWorkerDependency(input.request,
        input.dependencyStore.storeDigest), jobRoot: broker.jobRoot,
        workRoot: broker.workRoot, ...roots, artifactRoot: broker.artifactRoot,
        supplyProofFile: join(broker.jobRoot, "control", "supply-proof.json"),
        commandPath: input.config.commandPath,
        commandTimeoutMs: input.config.commandTimeoutMs,
        cancelGraceMs: input.config.cancelGraceMs,
        prepared: { security: input.scanned.prepared.security,
          sourceSnapshot: input.scanned.prepared.sourceSnapshot } },
      supplyProof: expectedReleaseBuildSupplyProof(input.profile),
      brokerUid: input.config.brokerUid, brokerGid: input.config.brokerGid,
      timeoutMs: input.config.commandTimeoutMs, signal: input.signal,
    };
    const result = input.config.externalOci
      ? await runExternalOciBroker({ ...brokerInput,
        image: input.config.externalOci.image,
        dockerExecutable: input.config.externalOci.dockerExecutable,
        launcherLabel: input.config.externalOci.launcherLabel })
      : await runTrustedTestBroker(brokerInput);
    if (result.status !== "succeeded" || !result.result)
      throw result.failure ?? new Error("broker failed");
    await promoteBrokerArtifacts({ rawRoot: broker.artifactRoot,
      trustedRoot: input.scanned.artifactRoot,
      finalRoot: join(input.config.outputRoot, "artifacts"),
      projectId: input.request.identity.projectId,
      releaseOrderId: input.request.identity.releaseOrderId,
      buildRunId: input.request.identity.buildRunId, result: result.result });
    return result.result;
  } finally { await broker.cleanup(); }
}

function runTrustedTestBroker(input: Parameters<typeof runReleaseBuildBrokerProcess>[0]) {
  if (process.env.NODE_ENV !== "test")
    throw new Error("same-process UID broker is restricted to trusted tests");
  return runReleaseBuildBrokerProcess(input);
}
