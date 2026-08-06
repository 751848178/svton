export const releaseStagingContext = {
  id: "order-1",
  project: {
    environments: [
      {
        id: "staging-1",
        name: "Staging",
        currentConfigRevisionId: "config-1",
      },
    ],
  },
};

export const releaseStagingManifest = {
  id: "manifest-1",
  digest: `sha256:${"a".repeat(64)}`,
  buildRun: {
    id: "build-1",
    teamId: "team-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    status: "succeeded",
    sourceBranch: "main",
    sourceCommitSha: "b".repeat(40),
  },
  items: [
    {
      componentKey: "project-bundle",
      uri: "release-artifact://build-1/bundle.zip",
      digest: `sha256:${"a".repeat(64)}`,
    },
  ],
};

export function releaseStagingInput() {
  return {
    teamId: "team-1",
    actorId: "user-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    manifestId: "manifest-1",
  };
}

export function deploymentInputSnapshot() {
  return {
    version: 1 as const,
    configRevision: {
      id: "config-1",
      revision: 1,
      snapshotHash: "config-hash",
      stateHash: "config-state-hash",
    },
    plainVariableKeys: [],
    secretReferences: [],
    resourceReferences: [],
    target: {
      bindingId: "binding-1",
      serverId: "server-1",
      providerKey: "provider-test-v1",
      targetRef: "provider-test-target",
      versionHash: "target-hash",
    },
    runtimeEnvironmentKeys: [],
    inputHash: "deployment-input-hash",
  };
}
