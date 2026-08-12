export function managedCommandWorkloadConfig(input: {
  healthCheckUrl?: string;
} = {}) {
  return {
    workingDirectory: ".",
    workloadExecutionMode: "managed-command-v1",
    deployCommand: "test -f dist/app.txt",
    statusCommand: "test -f dist/app.txt",
    failureCleanupCommand: "true",
    resourceRequirements: {
      cpuMillicores: 100,
      memoryBytes: 67_108_864,
      diskBytes: 67_108_864,
    },
    ...(input.healthCheckUrl ? { healthCheckUrl: input.healthCheckUrl } : {}),
  };
}

export function stagingArtifactProofParams(manifest: {
  id: string;
  digest: string;
  items: Array<{ componentKey: string; digest: string }>;
}) {
  return {
    version: 1,
    manifestId: manifest.id,
    manifestDigest: manifest.digest,
    workload: {
      services: manifest.items
        .filter((item) => item.componentKey !== "project-bundle")
        .map((item) => ({
          componentKey: item.componentKey,
          artifactDigest: item.digest,
        })),
    },
  };
}
