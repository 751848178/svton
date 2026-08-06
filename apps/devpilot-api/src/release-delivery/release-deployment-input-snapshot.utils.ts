import { ConflictException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type {
  ReleaseDeploymentInputSnapshot,
  ReleaseDeploymentInputState,
} from "./release-deployment-input.types";
import { isRecord } from "./release-deployment-input-reference.utils";
import {
  isSafeReleaseDeploymentSshRoot,
  releaseDeploymentSshTargetRef,
} from "./release-deployment-ssh-target.utils";

export function buildReleaseDeploymentInputSnapshot(
  state: ReleaseDeploymentInputState,
  providerKey: string,
  runtimeEnvironmentKeys: string[],
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
    plainVariableKeys: Object.keys(
      record(state.revision.plainVariables),
    ).sort(),
    secretReferences: state.secrets
      .map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
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
        versionHash: hash({
          environmentId: item.environmentId,
          status: item.status,
          updatedAt: item.updatedAt,
          runtime: item.runtime,
        }),
        environmentKeys: resourceEnvironmentKeys(item.runtime?.envTemplate),
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
    runtimeEnvironmentKeys: [...runtimeEnvironmentKeys].sort(),
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
  const matches = state.bindings.flatMap((binding) => {
    const metadata = record(binding.metadata);
    const deployment = record(metadata.releaseDeployment);
    if (deployment.providerKey !== providerKey) return [];
    if (providerKey === "ssh-v1") {
      const root = typeof deployment.root === "string" ? deployment.root : "";
      if (!isSafeReleaseDeploymentSshRoot(root)) return [];
      return [
        {
          binding,
          root,
          targetRef: releaseDeploymentSshTargetRef({
            username: binding.server.username,
            host: binding.server.host,
            port: binding.server.port,
            root,
          }),
        },
      ];
    }
    return typeof deployment.targetRef === "string"
      ? [{ binding, root: "", targetRef: deployment.targetRef }]
      : [];
  });
  if (matches.length !== 1) {
    throw new ConflictException("部署目标绑定缺失、重复或与 Provider 不匹配");
  }
  return matches[0];
}

function resourceEnvironmentKeys(template: string | null | undefined) {
  if (!template) return [];
  return template
    .split(/\r?\n/)
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter((key) => /^[A-Z_][A-Z0-9_]*$/.test(key))
    .sort();
}

function hash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function byId(left: { id: string }, right: { id: string }) {
  return left.id.localeCompare(right.id);
}
