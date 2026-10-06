'use client';

import { useTranslations } from 'next-intl';
import type { ProductionReleasePreview } from '../../types/release-production.types';

export function ProductionConfirmBasicSummary(props: { preview: ProductionReleasePreview }) {
  const t = useTranslations('projects');
  const snapshot = props.preview.snapshot;
  return (
    <div className="space-y-3">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Fact
          label={t('productionEnvironment')}
          value={snapshot.environment.name}
        />
        <Fact
          label={t('productionVersion')}
          value={snapshot.releaseOrder.releaseVersion}
        />
      </dl>
      <p className="text-sm text-muted-foreground">{t('releaseBasicProductionReuse')}</p>
    </div>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 font-medium">{props.value}</dd>
    </div>
  );
}
