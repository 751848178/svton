import { NextResponse, type NextRequest } from 'next/server';
import { buildLoginRedirectPath } from '@/lib/auth/redirect-path.utils';

const TOKEN_COOKIE = 'token';
// 路由保护采用「deny-list」语义:仅 PROTECTED_PREFIXES 内的路径要求登录,
// 其余路径(含首页 `/`)默认公开。首页 `(home)` 为公共营销落地页:
// 未登录用户可浏览,Header / HomeHeroCta / Footer 的「登录」入口对未登录态有效。
// 因此无需将 `/` 加入任何公开列表——它本就公开。
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
