import type { ReleaseGateCatalog } from '../types/release-gate.types';
import { settingsEnvironmentTabHref } from '../utils/settings-environment-route';
import { releaseActionGate } from './release-action-gate.model';

export function buildReleaseOrderGateView(input: {
  projectId: string;
  locale: string;
  catalog: ReleaseGateCatalog | null;
  state: { loading: boolean; error: string };
}) {
  const build = releaseActionGate(input.catalog, 'build', input.state, input.locale);
  const staging = releaseActionGate(input.catalog, 'staging', input.state, input.locale);
  return {
    build,
    staging,
    stagingHref:
      staging.repairArea === 'targets'
        ? settingsEnvironmentTabHref(
            input.projectId,
            input.catalog?.targetReadiness.environmentKey ?? null,
            'targets',
          )
        : undefined,
  };
}
