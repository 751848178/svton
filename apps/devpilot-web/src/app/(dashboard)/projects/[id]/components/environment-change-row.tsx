'use client';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type {
  EnvironmentVersionEnvironment,
  EnvironmentVersionItem,
} from '../types/environment-version.types';
import { environmentVersionKindLabelKey } from '../utils/release-copy.model';
import { formatIso } from '../utils/release-time.utils';

export function EnvironmentChangeRow(props: {
  environment: EnvironmentVersionEnvironment;
  version: EnvironmentVersionItem;
}) {
  const t = useTranslations('projects');
  const { environment, version } = props;
  const previous = environment.environmentVersions.find(
    (item) => item.id === version.previousVersionId,
  );
  const current = version.id === environment.currentEnvironmentVersionId;
  return (
    <tr
      data-environment-role={environment.baselineRole}
      data-version-kind={version.kind}
      data-version-id={version.id}
      data-version-current={current ? 'true' : 'false'}
    >
      <th
        scope="row"
        className="px-4 py-3 text-left font-medium"
      >
        {environment.name}
      </th>
      <td className="px-4 py-3">{t(environmentVersionKindLabelKey(version.kind))}</td>
      <td className="px-4 py-3 font-mono">
        {previous
          ? `${previous.releaseOrder.releaseVersion} → ${version.releaseOrder.releaseVersion}`
          : version.releaseOrder.releaseVersion}
      </td>
      <td className="px-4 py-3 font-mono">{shortManifest(version.artifactManifest.id)}</td>
      <td className="px-4 py-3">
        {current ? (
          <StatusTag
            status="success"
            label={t('environmentVersionResultSuccess')}
          />
        ) : (
          <StatusTag
            status="default"
            label={t('environmentVersionResultHistory')}
          />
        )}
      </td>
      <td className="px-4 py-3">{formatIso(version.effectiveAt)}</td>
    </tr>
  );
}

function shortManifest(id: string) {
  return id.length > 14 ? `${id.slice(0, 12)}…` : id;
}
