import { signWorkerDependencyReady,
  } from "./release-build-worker-envelope.policy";
import type { AssignedReleaseBuildWorkerRequest } from "./release-build-worker-stage-envelope.policy";
import { writeImmutableWorkerJson } from "./release-build-worker-exchange";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";

export async function publishWorkerDependencyReady(input: {
  outputDirectory: string; secretFile: string; request: AssignedReleaseBuildWorkerRequest;
  dependencyStore: { fetchRunId: string; cacheGeneration: number;
    combinationHash: string; storeDigest: string };
}) {
  const secret = await readReleaseBuildWorkerSecret(input.secretFile);
  await writeImmutableWorkerJson(input.outputDirectory, "dependency-ready.json",
    signWorkerDependencyReady({ version: 1, identity: input.request.identity,
      dependencyStore: input.dependencyStore }, secret));
}
