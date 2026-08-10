import { ApiError } from '@svton/api-client';

export function shouldReportLoadError(error: unknown) {
  if (!(error instanceof ApiError)) return true;
  return typeof error.code !== 'number' || error.code < 400 || error.code >= 500;
}
