import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';
import type { ProjectDeliverySummary } from './types/project-delivery-summary.types';
import { ProjectRouteHost } from './components/project-route-host';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let initialSummary: ProjectDeliverySummary | undefined;
  try {
    initialSummary = await serverRequest<ProjectDeliverySummary>(
      `GET:/projects/${id}/delivery/summary`,
    );
  } catch (error) {
    redirectOnUnauthorized(error, `/projects/${id}`);
    console.error('Failed to load project delivery summary:', error);
  }
  return (
    <ProjectRouteHost
      mode="delivery"
      initialSummary={initialSummary}
    />
  );
}
