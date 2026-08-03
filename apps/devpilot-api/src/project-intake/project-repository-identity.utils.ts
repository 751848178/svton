import type {
  LegacyProjectIntakeSnapshot,
  RepositoryIdentityCandidate,
} from "./project-intake-preflight.types";

export interface NormalizedRepositoryIdentity {
  canonicalKey: string;
  canonicalUrl: string;
}

function normalizedPath(value: string): string {
  return value
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "")
    .toLowerCase();
}

function fromScpSyntax(value: string): NormalizedRepositoryIdentity | null {
  if (value.includes("://")) return null;
  const match = value.match(/^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/);
  if (!match) return null;
  return identity(match[1], normalizedPath(match[2]));
}

function fromUrl(value: string): NormalizedRepositoryIdentity | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "file:") {
      return localIdentity(normalizedPath(parsed.pathname));
    }
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port ? `:${parsed.port}` : "";
    return identity(`${host}${port}`, normalizedPath(parsed.pathname));
  } catch {
    return null;
  }
}

function localIdentity(path: string): NormalizedRepositoryIdentity | null {
  if (!path) return null;
  return { canonicalKey: `local/${path}`, canonicalUrl: `file:///${path}` };
}

function identity(
  host: string,
  path: string,
): NormalizedRepositoryIdentity | null {
  if (!host || !path) return null;
  const canonicalKey = `${host.toLowerCase()}/${path}`;
  return { canonicalKey, canonicalUrl: `https://${canonicalKey}` };
}

export function normalizeRepositoryIdentity(
  repositoryUrl?: string | null,
): NormalizedRepositoryIdentity | null {
  const value = repositoryUrl?.trim();
  if (!value) return null;
  if (value.startsWith("/")) return localIdentity(normalizedPath(value));
  return fromScpSyntax(value) ?? fromUrl(value);
}

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
    provider: project.repository?.provider?.trim().toLowerCase() || "generic",
    providerRepositoryId: project.repository?.externalRepositoryId ?? null,
    canonicalKey: normalized.canonicalKey,
    canonicalUrl: normalized.canonicalUrl,
    defaultBranch: project.repository?.defaultBranch ?? null,
  };
}
