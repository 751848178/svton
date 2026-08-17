import type { ReleaseBuildArtifactService } from "./release-build-artifact.service";
import type { ReleaseBuildPackageEvidenceService } from "./release-build-package-evidence.service";
import type { ReleaseBuildPreScriptSecurityService } from "./release-build-pre-script-security.service";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";

export function releaseBuildGateSummary(input: {
  profile: RegisteredReleaseBuildProfile;
  packageEvidence: Awaited<ReturnType<ReleaseBuildPackageEvidenceService["execute"]>>;
  prepared: Awaited<ReturnType<ReleaseBuildPreScriptSecurityService["prepare"]>>;
  artifact: Awaited<ReturnType<ReleaseBuildArtifactService["package"]>>;
  componentCount: number;
}) {
  return {
    source: { status: "passed", checkout: "exact_commit" },
    install: input.packageEvidence.install,
    build: { status: "passed", components: input.componentCount },
    tests: input.packageEvidence.tests,
    quality: input.packageEvidence.quality,
    artifact: {
      status: "passed",
      contractVersion: 1,
      collection: "declared-outputs-only",
      components: input.artifact.items.length,
      environmentBoundComponents: input.artifact.items.filter(
        (item) => item.environment.mode === "baked",
      ).length,
    },
    security: {
      ...input.prepared.security,
      sourceSnapshot: input.prepared.sourceSnapshot,
      executionControls: {
        status: "passed",
        profile: input.profile.id,
        trustBoundary: "disposable-api-container",
        untrustedSandbox: false,
        controls: [
          "minimal_environment",
          "working_directory_confinement",
          "bounded_process_group",
          "source_scan_before_repository_scripts",
          "separate_build_workspace",
        ],
        limitations: ["shared_api_process", "shared_container_network"],
      },
    },
  };
}
