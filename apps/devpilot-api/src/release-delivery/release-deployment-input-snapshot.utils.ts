import type {
  ReleaseDeploymentInputSnapshot,
  ReleaseDeploymentInputState,
} from "./release-deployment-input.types";
import { hashCanonicalReleaseValue } from "./release-canonical-hash.utils";
import { ReleaseDeploymentTargetConflict } from "./release-deployment-target-error";
import { resolveReleaseDeploymentTargetReadiness } from "./release-deployment-target-readiness.model";
import {
  effectiveResourceBindings,
  environmentKeysFromTemplate,
} from "../project-environment/environment-variable-binding.utils";
import { frozenRouteTargets } from "./release-deployment-route-snapshot.utils";

export function buildReleaseDeploymentInputSnapshot(
  state: ReleaseDeploymentInputState,
  providerKey: string,
  globalEnvironmentKeys: string[],
  componentEnvironmentKeys: Record<string, string[]> = {},
  target = selectReleaseDeploymentTarget(state, providerKey),
) {
  const snapshotWithoutHash = {
    version: 1 as const,
    configRevision: {
      id: state.revision.id,
      revision: state.revision.revision,
      snapshotHash: state.revision.snapshotHash,
      stateHash: hash({
        plainVariables: state.revision.plainVariables,
        secretReferences: state.revision.secretReferences,
        resourceReferences: state.revision.resourceReferences,
      }),
    },
    routeTargets: frozenRouteTargets(state.revision.routeSnapshot),
    plainVariableKeys: Object.keys(
      record(state.revision.plainVariables),
    ).sort(),
    secretReferences: state.secrets
      .map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        targetEnvKey: item.targetEnvKey ?? item.name.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
        versionHash: hash({ value: item.value, updatedAt: item.updatedAt }),
      }))
      .sort(byId),
    resourceReferences: state.resources
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        status: item.status,
        environmentId: item.environmentId,
        sharedEnvironmentIds: item.sharedEnvironmentIds,
        componentKey: item.componentKey ?? "",
        versionHash: hash({
          environmentId: item.environmentId,
          status: item.status,
          updatedAt: item.updatedAt,
          runtime: item.runtime,
        }),
        envBindings: effectiveResourceBindings(
          item,
          environmentKeysFromTemplate(item.runtime?.envTemplate),
        ).sort((left, right) => left.sourceKey.localeCompare(right.sourceKey)),
        environmentKeys: effectiveResourceBindings(
          item,
          environmentKeysFromTemplate(item.runtime?.envTemplate),
        ).map((binding) => binding.targetEnvKey).sort(),
      }))
      .sort(byId),
    target: {
      bindingId: target.binding.id,
      serverId: target.binding.server.id,
      providerKey,
      targetRef: target.targetRef,
      versionHash: hash({
        metadata: target.binding.metadata,
        bindingUpdatedAt: target.binding.updatedAt,
        server: target.binding.server,
      }),
    },
    runtimeEnvironmentKeys: [...new Set([
      ...globalEnvironmentKeys,
      ...Object.values(componentEnvironmentKeys).flat(),
    ])].sort(),
    globalEnvironmentKeys: [...globalEnvironmentKeys].sort(),
    componentEnvironmentKeys: Object.fromEntries(
      Object.entries(componentEnvironmentKeys)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, values]) => [key, [...values].sort()]),
    ),
  };
  return {
    snapshot: {
      ...snapshotWithoutHash,
      inputHash: hash(snapshotWithoutHash),
    } satisfies ReleaseDeploymentInputSnapshot,
    binding: target.binding,
    root: target.root,
  };
}

export function selectReleaseDeploymentTarget(
  state: ReleaseDeploymentInputState,
  providerKey: string,
) {
  const readiness = resolveReleaseDeploymentTargetReadiness(
    state.bindings,
    providerKey,
  );
  if (!readiness.currentTarget) {
    throw new ReleaseDeploymentTargetConflict(readiness);
  }
  return readiness.currentTarget;
}

const hash = hashCanonicalReleaseValue;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function byId(left: { id: string }, right: { id: string }) {
  return left.id.localeCompare(right.id);
}
