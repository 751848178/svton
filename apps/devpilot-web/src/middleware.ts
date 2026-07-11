import { NextResponse, type NextRequest } from 'next/server';
import { buildLoginRedirectPath } from '@/lib/auth/redirect-path.utils';

const TOKEN_COOKIE = 'token';
const PROTECTED_PREFIXES = [
  '/access-policies',
  '/admin',
  '/applications',
  '/audit-events',
  '/backups',
  '/cdn',
  '/cdn-configs',
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
  '/teams',
];

const AUTH_PREFIXES = ['/login', '/register'];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (!hasToken && startsWithAny(pathname, PROTECTED_PREFIXES)) {
    return NextResponse.redirect(new URL(buildLoginRedirectPath(pathname, search), request.url));
  }

  if (hasToken && startsWithAny(pathname, AUTH_PREFIXES)) {
    return NextResponse.redirect(new URL('/teams', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
