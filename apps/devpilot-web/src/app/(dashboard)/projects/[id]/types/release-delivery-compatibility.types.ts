export interface ReleaseDeliveryCompatibility {
  schemaVersion: 1;
  mode: 'read_only_compatibility';
  executionBoundary: {
    newDeliveryInput: 'persisted_artifact_manifest';
    checkoutDuringDeployment: false;
    buildDuringDeployment: false;
    legacyBranchDeploymentForGovernedProject: false;
  };
  report: {
    summary: {
      linkedReleasePlans: number;
      linkedDeploymentRuns: number;
      linkedEnvironmentVersions: number;
      unverified: number;
      syntheticManifests: 0;
    };
  };
  history: {
    releasePlans: number;
    deploymentRuns: Array<{
      id: string;
      classification: 'manifest_verified' | 'legacy_unverified';
      logsRetained: boolean;
      readOnly: true;
    }>;
    logStreams: number;
    logEntries: number;
  };
}
