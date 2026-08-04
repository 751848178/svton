export interface NormalizedRepositoryIdentity {
  canonicalKey: string;
  canonicalUrl: string;
  provider: string;
}

function normalizedPath(value: string): string {
  return value
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "")
    .toLowerCase();
}

function detectProvider(host: string): string {
  if (host === "local") return "local";
  if (/(^|\.)github\.com$/i.test(host)) return "github";
  if (/(^|\.)gitee\.com$/i.test(host)) return "gitee";
  if (/(^|\.)gitlab\./i.test(host) || /(^|\.)gitlab\.com$/i.test(host)) {
    return "gitlab";
  }
  return "generic";
}

function identity(host: string, path: string): NormalizedRepositoryIdentity | null {
  if (!host || !path) return null;
  const canonicalHost = host.toLowerCase();
  const canonicalKey = `${canonicalHost}/${path}`;
  return {
    canonicalKey,
    canonicalUrl: `https://${canonicalKey}`,
    provider: detectProvider(canonicalHost.split(":")[0]),
  };
}

function localIdentity(path: string): NormalizedRepositoryIdentity | null {
  if (!path) return null;
  return {
    canonicalKey: `local/${path}`,
    canonicalUrl: `file:///${path}`,
    provider: "local",
  };
}

function fromScpSyntax(value: string): NormalizedRepositoryIdentity | null {
  if (value.includes("://")) return null;
  const match = value.match(/^(?:[^@/\s]+@)?([^:/\s]+):(.+)$/);
  return match ? identity(match[1], normalizedPath(match[2])) : null;
}

function fromUrl(value: string): NormalizedRepositoryIdentity | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "file:") return localIdentity(normalizedPath(parsed.pathname));
    const port = parsed.port ? `:${parsed.port}` : "";
    return identity(`${parsed.hostname}${port}`, normalizedPath(parsed.pathname));
  } catch {
    return null;
  }
}

export function normalizeRepositoryIdentity(
  repositoryUrl?: string | null,
): NormalizedRepositoryIdentity | null {
  const value = repositoryUrl?.trim();
  if (!value) return null;
  if (value.startsWith("/")) return localIdentity(normalizedPath(value));
  return fromScpSyntax(value) ?? fromUrl(value);
}
