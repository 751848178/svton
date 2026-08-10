/**
 * Shared deployment-target binding matching (F445).
 *
 * The deploy path and the settings "current target" display must resolve the
 * provider-matched binding identically (AC-SET-023). This module extracts the
 * match loop from `selectReleaseDeploymentTarget` so both callers share it:
 * - ssh-v1 bindings match only when `metadata.releaseDeployment.root` is a safe
 *   SSH root; their targetRef is always derived from server + root.
 * - other providers match on `metadata.releaseDeployment.targetRef`.
 *
 * Exactly-one-active remains enforced by callers (deploy fails closed with a
 * Conflict; gates fail closed with an unavailable/blocked evaluation).
 */
import {
  isSafeReleaseDeploymentSshRoot,
  releaseDeploymentSshTargetRef,
} from "./release-deployment-ssh-target.utils";

export interface ReleaseDeploymentTargetBindingLike {
  id: string;
  metadata?: unknown;
  server: {
    id: string;
    host?: string | null;
    port?: number | null;
    username?: string | null;
  };
}

export interface MatchedReleaseDeploymentTarget<B = ReleaseDeploymentTargetBindingLike> {
  binding: B;
  root: string;
  targetRef: string;
}

export function matchReleaseDeploymentTargetBindings<
  B extends ReleaseDeploymentTargetBindingLike,
>(
  bindings: B[],
  providerKey: string,
): MatchedReleaseDeploymentTarget<B>[] {
  return bindings.flatMap((binding) => {
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
            username: binding.server.username ?? "",
            host: binding.server.host ?? "",
            port: binding.server.port ?? 0,
            root,
          }),
        },
      ];
    }
    return typeof deployment.targetRef === "string"
      ? [{ binding, root: "", targetRef: deployment.targetRef }]
      : [];
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
