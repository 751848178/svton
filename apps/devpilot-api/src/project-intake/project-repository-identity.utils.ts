import type {
  LegacyProjectIntakeSnapshot,
  RepositoryIdentityCandidate,
} from "./project-intake-preflight.types";
import { normalizeRepositoryIdentity } from "../repository-identity/repository-identity.utils";

export { normalizeRepositoryIdentity } from "../repository-identity/repository-identity.utils";

export function toRepositoryIdentityCandidate(
  project: LegacyProjectIntakeSnapshot,
): RepositoryIdentityCandidate | null {
  const repositoryUrl = project.repository?.repositoryUrl ?? project.gitRepo;
  const normalized = normalizeRepositoryIdentity(repositoryUrl);
  if (!normalized) return null;
  return {
    projectId: project.projectId,
    teamId: project.teamId,
    repositoryConnectionId: project.repository?.id ?? null,
    provider: normalized.provider,
    providerRepositoryId: project.repository?.externalRepositoryId ?? null,
    canonicalKey: normalized.canonicalKey,
    canonicalUrl: normalized.canonicalUrl,
    defaultBranch: project.repository?.defaultBranch ?? null,
  };
}
