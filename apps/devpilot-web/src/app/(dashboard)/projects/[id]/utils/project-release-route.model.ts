import { buildProjectRoute } from './project-route-query.utils';

export function projectReleaseListPath(projectId: string) {
  return `/projects/${encodeURIComponent(projectId)}/releases`;
}

export function projectReleaseDetailPath(projectId: string, releaseOrderId: string) {
  return `${projectReleaseListPath(projectId)}/${encodeURIComponent(releaseOrderId)}`;
}

export function legacyReleaseDetailHref(projectId: string, searchParams: URLSearchParams) {
  const releaseOrderId = searchParams.get('releaseOrderId')?.trim();
  if (!releaseOrderId) return null;
  const next = new URLSearchParams(searchParams);
  next.delete('releaseOrderId');
  next.delete('view');
  next.delete('tab');
  return buildProjectRoute(projectReleaseDetailPath(projectId, releaseOrderId), next);
}
