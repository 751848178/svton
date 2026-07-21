const DEFAULT_AUTH_REDIRECT = '/dashboard';

export function toSafeRedirectPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_AUTH_REDIRECT;
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_AUTH_REDIRECT;
  if (value.startsWith('/login') || value.startsWith('/register')) return DEFAULT_AUTH_REDIRECT;
  return value;
}

export function buildLoginRedirectPath(pathname: string, search = ''): string {
  const redirect = toSafeRedirectPath(`${pathname}${search}`);
  return `/login?redirect=${encodeURIComponent(redirect)}`;
}
