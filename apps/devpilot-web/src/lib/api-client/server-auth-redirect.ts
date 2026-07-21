import { redirect } from 'next/navigation';
import { ApiError } from '@svton/api-client';
import { buildLoginRedirectPath } from '@/lib/auth/redirect-path.utils';

export function isUnauthorizedApiError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 401 || error.code === '401');
}

export function redirectOnUnauthorized(error: unknown, redirectPath = '/dashboard'): void {
  if (isUnauthorizedApiError(error)) {
    redirect(buildLoginRedirectPath(redirectPath));
  }
}
