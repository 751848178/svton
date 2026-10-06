const TEAM_REQUIRED_PREFIXES = [
  '/access-policies',
  '/applications',
  '/audit-events',
  '/backups',
  '/cdn',
  '/cdn-configs',
  '/dashboard',
  '/domain',
  '/execution-governance',
  '/execution-policies',
  '/git',
  '/keys',
  '/logs',
  '/monitoring',
  '/operation-approvals',
  '/presets',
  '/projects',
  '/proxy-configs',
  '/resource-control',
  '/resource-instances',
  '/resource-requests',
  '/resources',
  '/servers',
  '/sites',
];

const PROTECTED_PREFIXES = ['/admin', '/teams', ...TEAM_REQUIRED_PREFIXES];

const AUTH_PATHS = ['/login', '/register'];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedPath(pathname: string): boolean {
  return startsWithAny(pathname, PROTECTED_PREFIXES);
}

export function isTeamRequiredPath(pathname: string): boolean {
  return startsWithAny(pathname, TEAM_REQUIRED_PREFIXES);
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.includes(pathname);
}
