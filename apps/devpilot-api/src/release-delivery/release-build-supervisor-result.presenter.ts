export function supervisorGateSummary(
  value: Record<string, unknown>,
  prepared: { security: unknown; sourceSnapshot: unknown },
  supplyChainDigest: string,
  externalOci: boolean,
  dependencyStore?: { fetchRunId: string; cacheGeneration: number;
    storeDigest: string },
) {
  return { ...value, dependencyStore: dependencyStore ? {
    status: "passed", contract: "lockfile-bound-dependency-store-v1",
    ...dependencyStore,
  } : { status: "unavailable", reasonCode: "dependency_store_evidence_missing" },
  security: { ...(prepared.security as object),
    sourceSnapshot: prepared.sourceSnapshot,
    executionControls: { status: "passed", profile: "controlled-local-acceptance-v2",
      trustBoundary: externalOci ? "trusted-host-supervisor-per-job-oci" : "trusted-test-fixture",
      untrustedSandbox: externalOci, controls: externalOci
        ? ["supervisor_pre_script_scan", "immutable_job_image", "private_pid_namespace",
          "read_only_rootfs", "network_none", "kill_remove_before_promote",
          "supervisor_signed_output"] : ["trusted_test_fixture"],
      limitations: externalOci ? [] : ["not_available_for_untrusted_repositories"] } },
    workerAttestation: { version: 1, supplyChainDigest,
      boundary: externalOci ? "external-oci-launcher-v1" : "trusted-test-fixture" } };
}
