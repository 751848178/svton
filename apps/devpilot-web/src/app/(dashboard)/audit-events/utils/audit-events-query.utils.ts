export type AuditEventScope = {
  projectId?: string;
  category?: string;
  status?: string;
  risk?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const SCOPE_KEYS = ['projectId', 'category', 'status', 'risk'] as const;

export function auditEventScopeFromSearchParams(searchParams: SearchParams): AuditEventScope {
  const scope: AuditEventScope = {};
  for (const key of SCOPE_KEYS) {
    const raw = searchParams[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value) scope[key] = value;
  }
  return scope;
}

export function auditEventsApiName(scope: AuditEventScope): string {
  const params = new URLSearchParams();
  for (const key of SCOPE_KEYS) {
    const value = scope[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `GET:/audit-events${query ? `?${query}` : ''}`;
}
