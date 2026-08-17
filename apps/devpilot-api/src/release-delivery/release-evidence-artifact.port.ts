export type ReleaseEvidenceArtifactInput = {
  projectId: string;
  releaseOrderId: string;
  buildRunId: string;
  category: string;
  report: unknown;
};

export type ReleaseEvidenceArtifactReference = {
  evidenceRef: string;
  reportDigest: string;
  sizeBytes: number;
};

export abstract class ReleaseEvidenceArtifactPort {
  abstract publish(
    input: ReleaseEvidenceArtifactInput,
  ): Promise<ReleaseEvidenceArtifactReference>;
}
