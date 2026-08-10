import { matchReleaseDeploymentTargetBindings } from "./release-deployment-target-match.utils";

export const RELEASE_DEPLOYMENT_TARGET_REASON_CODES = [
  "TARGET_READY",
  "TARGET_MISSING",
  "TARGET_DUPLICATED",
  "PROVIDER_MISMATCH",
  "SSH_ROOT_INVALID",
  "SSH_CONNECTION_INVALID",
] as const;

export type ReleaseDeploymentTargetReasonCode =
  (typeof RELEASE_DEPLOYMENT_TARGET_REASON_CODES)[number];

export type ReleaseDeploymentTargetMatchState =
  | "ready"
  | "missing"
  | "duplicated"
  | "provider_mismatch"
  | "ssh_root_invalid"
  | "ssh_connection_invalid";

type Binding = Parameters<typeof matchReleaseDeploymentTargetBindings>[0][number];

export type ReleaseDeploymentTargetReadiness<B extends Binding = Binding> = {
  expectedProviderKey: string;
  bindingCount: number;
  matchState: ReleaseDeploymentTargetMatchState;
  reasonCode: ReleaseDeploymentTargetReasonCode;
  currentTarget: null | {
    binding: B;
    root: string;
    targetRef: string;
  };
  remediation: "environment_targets" | null;
};

export function resolveReleaseDeploymentTargetReadiness<B extends Binding>(
  bindings: B[],
  expectedProviderKey: string,
): ReleaseDeploymentTargetReadiness<B> {
  const matches = matchReleaseDeploymentTargetBindings(
    bindings,
    expectedProviderKey,
  );
  if (matches.length === 1) {
    if (
      expectedProviderKey === "ssh-v1" &&
      !validSshConnection(matches[0].binding.server)
    ) {
      return readiness(
        expectedProviderKey,
        bindings.length,
        "ssh_connection_invalid",
        "SSH_CONNECTION_INVALID",
      );
    }
    return readiness(expectedProviderKey, bindings.length, "ready", "TARGET_READY", {
      binding: matches[0].binding as B,
      root: matches[0].root,
      targetRef: matches[0].targetRef,
    });
  }
  if (matches.length > 1) {
    return readiness(
      expectedProviderKey,
      bindings.length,
      "duplicated",
      "TARGET_DUPLICATED",
    );
  }
  if (bindings.length === 0) {
    return readiness(
      expectedProviderKey,
      0,
      "missing",
      "TARGET_MISSING",
    );
  }
  const providerBindings = bindings.filter(
    (binding) => providerKeyOf(binding.metadata) === expectedProviderKey,
  );
  if (providerBindings.length === 0) {
    return readiness(
      expectedProviderKey,
      bindings.length,
      "provider_mismatch",
      "PROVIDER_MISMATCH",
    );
  }
  return readiness(
    expectedProviderKey,
    bindings.length,
    expectedProviderKey === "ssh-v1" ? "ssh_root_invalid" : "missing",
    expectedProviderKey === "ssh-v1" ? "SSH_ROOT_INVALID" : "TARGET_MISSING",
  );
}

function validSshConnection(server: Binding["server"]) {
  return (
    server.status === "online" &&
    Boolean(server.host?.trim()) &&
    Number.isInteger(server.port) &&
    Number(server.port) > 0 &&
    Number(server.port) <= 65_535 &&
    Boolean(server.username?.trim()) &&
    (server.authType === "password" || server.authType === "key") &&
    Boolean(server.credentials?.trim())
  );
}

function readiness<B extends Binding>(
  expectedProviderKey: string,
  bindingCount: number,
  matchState: ReleaseDeploymentTargetMatchState,
  reasonCode: ReleaseDeploymentTargetReasonCode,
  currentTarget: ReleaseDeploymentTargetReadiness<B>["currentTarget"] = null,
): ReleaseDeploymentTargetReadiness<B> {
  return {
    expectedProviderKey,
    bindingCount,
    matchState,
    reasonCode,
    currentTarget,
    remediation: matchState === "ready" ? null : "environment_targets",
  };
}

function providerKeyOf(metadata: unknown) {
  const root = record(metadata);
  const deployment = record(root.releaseDeployment);
  return typeof deployment.providerKey === "string"
    ? deployment.providerKey
    : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
