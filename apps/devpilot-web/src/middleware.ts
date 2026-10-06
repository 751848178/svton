import { NextResponse, type NextRequest } from 'next/server';
import {
  buildLoginRedirectPath,
  buildTeamRequiredRedirectPath,
} from '@/lib/auth/redirect-path.utils';
import { isProtectedPath, isTeamRequiredPath } from '@/lib/auth/protected-paths.utils';

const TOKEN_COOKIE = 'token';
const TEAM_COOKIE = 'teamId';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (!hasToken && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL(buildLoginRedirectPath(pathname, search), request.url));
  }

  const hasTeam = Boolean(request.cookies.get(TEAM_COOKIE)?.value);
  if (hasToken && !hasTeam && isTeamRequiredPath(pathname)) {
    return NextResponse.redirect(
      new URL(buildTeamRequiredRedirectPath(pathname, search), request.url),
    );
  }

  // Auth pages remain reachable even when a token cookie exists. The client
  // reconciles cookie + localStorage state and redirects only after it has a
  // usable persisted identity. This avoids stale/cross-port cookie loops.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
