import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { shortTechnicalId } from '../utils/release-display.utils';
import type { ReleaseTechnicalDetailItem } from './release-technical-details';

export function stagingLogEvidenceItems(
  run: ReleaseStagingDeploymentItem | null,
  build: ReleaseBuildItem | null,
  t: (key: string) => string,
): ReleaseTechnicalDetailItem[] {
  if (!run) return [];
  const items: ReleaseTechnicalDetailItem[] = [
    {
      key: 'runId',
      label: t('releaseStagingDeploymentRunId'),
      value: shortTechnicalId(run.id),
      title: run.id,
    },
  ];
  if (build) {
    items.push({
      key: 'buildId',
      label: t('releaseBuildId'),
      value: shortTechnicalId(build.id),
      title: build.id,
    });
  }
  if (build?.manifest?.digest) {
    items.push({
      key: 'manifestDigest',
      label: t('releaseBuildManifestDigest'),
      value: build.manifest.digest,
    });
  }
  return items;
}

export function stagingLogDisplay(value: unknown, empty: string) {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join('\n')
    : typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : '';
  if (!raw) return empty;
  const maxLength = 12_000;
  return raw.length > maxLength ? `${raw.slice(0, maxLength)}\n…` : raw;
}
