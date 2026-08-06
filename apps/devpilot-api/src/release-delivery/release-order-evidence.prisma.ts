export const releaseEvidenceManifestSelect = {
  id: true,
  teamId: true,
  projectId: true,
  releaseOrderId: true,
  buildRunId: true,
  digest: true,
  createdAt: true,
  items: {
    select: { componentKey: true, artifactType: true, digest: true },
    orderBy: { componentKey: "asc" as const },
  },
  buildRun: {
    select: {
      id: true,
      teamId: true,
      projectId: true,
      releaseOrderId: true,
      revision: true,
      sourceBranch: true,
      sourceCommitSha: true,
      status: true,
    },
  },
} as const;

export const releaseEvidenceEnvironmentSelect = {
  id: true,
  teamId: true,
  projectId: true,
  name: true,
  baselineRole: true,
  status: true,
} as const;

export const releaseEvidenceDeploymentSelect = {
  id: true,
  teamId: true,
  projectId: true,
  releaseRunId: true,
  environmentId: true,
  artifactManifestId: true,
  status: true,
  executorKey: true,
  adapterKey: true,
  branch: true,
  commitSha: true,
  error: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  result: true,
  projectEnvironment: { select: releaseEvidenceEnvironmentSelect },
  artifactManifest: { select: releaseEvidenceManifestSelect },
} as const;
