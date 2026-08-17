import type { ReleaseGateDeployEvidence } from "./release-gate-deploy-evidence.types";
import { resourceReferences } from "./release-gate-deploy-reference.utils";

export type RuntimeResourceCoverage = {
  referenceId: string;
  referenceKind: string;
  stateful: boolean;
  managedResourceId: string | null;
  reasonCode?: string;
};

export function runtimeResourceCoverage(
  deploy: ReleaseGateDeployEvidence | undefined,
): RuntimeResourceCoverage[] | null {
  const revision = deploy?.environment?.currentConfigRevision;
  if (!revision) return null;
  const refs = resourceReferences(revision.resourceReferences).filter((ref) =>
    ref.kind === "managed_resource" || ref.kind === "resource_instance",
  );
  if (refs.some((ref) => typeof ref.stateful !== "boolean")) return null;
  return refs.map((ref) => {
    const resource = deploy.resources.find((item) =>
      item.id === ref.id && item.kind === ref.kind,
    );
    if (!resource) return missing(ref, "resource_reference_unresolved");
    if (
      resource.kind === "managed_resource" &&
      resource.environmentId !== deploy.environment?.id
    ) {
      return missing(ref, "resource_environment_mismatch");
    }
    if (ref.kind === "managed_resource") {
      return coverage(ref, ref.id);
    }
    if (
      resource.environmentId !== null &&
      resource.environmentId !== deploy.environment?.id
    ) {
      return missing(ref, "resource_environment_mismatch");
    }
    const mapped = resource.mappedManagedResourceIds ?? [];
    if (mapped.length !== 1) {
      return missing(
        ref,
        mapped.length === 0
          ? "resource_instance_managed_mapping_missing"
          : "resource_instance_managed_mapping_ambiguous",
      );
    }
    return coverage(ref, mapped[0]);
  });
}

function coverage(
  ref: { id: string; kind: string; stateful?: boolean },
  managedResourceId: string,
): RuntimeResourceCoverage {
  return {
    referenceId: ref.id,
    referenceKind: ref.kind,
    stateful: ref.stateful === true,
    managedResourceId,
  };
}

function missing(
  ref: { id: string; kind: string; stateful?: boolean },
  reasonCode: string,
): RuntimeResourceCoverage {
  return {
    referenceId: ref.id,
    referenceKind: ref.kind,
    stateful: ref.stateful === true,
    managedResourceId: null,
    reasonCode,
  };
}
