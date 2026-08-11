import { JSON_SCHEMA, load } from "js-yaml";

const AUTH_KEY = /(?:^|:)(?:_?auth(?:token)?|npmAuthToken|password|token|username|email|always-auth)$/i;
const AUTH_VALUE = /(?:^|[\s"'])(?:\/\/[^\s:]+\/?:)?(?:_?auth(?:token)?|npmAuthToken|password|username|email|always-auth)\s*[:=]/i;
const SENSITIVE_QUERY = /(?:^|[-_])(?:auth|token|key|signature|sig|password|credential)$/i;
const PROTOCOL = /^[a-z][a-z0-9+.-]*:/i;

export function validateDependencyLockAst(bytes: Buffer, registry: string) {
  let document: unknown;
  try {
    document = load(bytes.toString("utf8"), { schema: JSON_SCHEMA,
      json: false });
  } catch { return "lockfile_yaml_invalid"; }
  if (!record(document)) return "lockfile_yaml_invalid";
  return inspect(document, registry, "") || null;
}

function inspect(value: unknown, registry: string, key: string): string | null {
  if (authKey(key)) return "dependency_auth_forbidden";
  if (typeof value === "string") return inspectScalar(value, registry, key);
  if (Array.isArray(value)) {
    for (const child of value) {
      const reason = inspect(child, registry, key);
      if (reason) return reason;
    }
  } else if (record(value)) {
    for (const [childKey, child] of Object.entries(value)) {
      const reason = inspect(child, registry, childKey);
      if (reason) return reason;
    }
  }
  return null;
}

function inspectScalar(value: string, registry: string, key: string) {
  const decoded = value.trim();
  if (AUTH_VALUE.test(decoded)) return "dependency_auth_forbidden";
  if (decoded.startsWith("//")) return "dependency_protocol_forbidden";
  if (!PROTOCOL.test(decoded)) {
    return key.toLowerCase() === "tarball" && decoded.length > 0
      ? "dependency_registry_host_forbidden" : null;
  }
  const protocol = decoded.slice(0, decoded.indexOf(":") + 1).toLowerCase();
  if (protocol === "workspace:") return null;
  if (protocol !== "https:") return "dependency_protocol_forbidden";
  let url: URL;
  try { url = new URL(decoded); } catch { return "dependency_protocol_forbidden"; }
  const expected = new URL(registry);
  if (url.username || url.password) return "dependency_auth_forbidden";
  for (const queryKey of url.searchParams.keys())
    if (SENSITIVE_QUERY.test(queryKey)) return "dependency_auth_forbidden";
  if (url.protocol !== "https:" || url.origin !== expected.origin ||
    url.hostname !== expected.hostname || url.port)
    return "dependency_registry_host_forbidden";
  return null;
}

function authKey(value: string) {
  const normalized = value.trim();
  return AUTH_KEY.test(normalized) ||
    (normalized.startsWith("//") && /:(?:_?auth|token|password|username|email)/i
      .test(normalized));
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
