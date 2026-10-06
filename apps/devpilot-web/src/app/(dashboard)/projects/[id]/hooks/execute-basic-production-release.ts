import { apiRequest } from '@/lib/api-client';
import type { ProductionReleaseRun } from '../types/release-order.types';

export function executeBasicProductionRelease(
  projectId: string,
  manifestId: string,
  run: ProductionReleaseRun,
) {
  return apiRequest(
    `POST:/projects/${projectId}/delivery/environment-versions/${run.environmentId}/actions`,
    {
      idempotencyKey: crypto.randomUUID(),
      kind: 'upgrade',
      manifestId,
      releaseRunId: run.id,
    },
  );
}
