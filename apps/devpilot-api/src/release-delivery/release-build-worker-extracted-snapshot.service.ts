import type { ReleaseBuildWorkerRequestIdentity } from "./release-build-worker-envelope.policy";
import {
  verifyExtractedWorkerSource,
  type WorkerSourceManifest,
} from "./release-build-worker-source-manifest";

export class ReleaseBuildWorkerExtractedSnapshotService {
  constructor(
    private readonly identity: ReleaseBuildWorkerRequestIdentity,
    private readonly manifest: WorkerSourceManifest,
  ) {}

  async verify(input: {
    checkoutRoot: string;
    sourceCommitSha: string;
  }) {
    if (input.sourceCommitSha !== this.identity.sourceCommitSha) {
      throw new Error("Worker source Commit does not match the request");
    }
    await verifyExtractedWorkerSource(input.checkoutRoot, this.manifest);
    return {
      sourceCommitSha: this.identity.sourceCommitSha,
      treeHash: this.identity.sourceTreeHash,
      snapshotDigest: this.identity.sourceSnapshotDigest,
    };
  }
}
