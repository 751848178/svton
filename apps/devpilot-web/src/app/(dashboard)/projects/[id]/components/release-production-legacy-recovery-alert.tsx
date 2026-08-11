'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { LegacyPromotionRecovery } from '../types/environment-version.types';

export function ReleaseProductionLegacyRecoveryAlert(props: {
  recovery?: LegacyPromotionRecovery;
  executing?: boolean;
  onReconcile?: (promotionCommandId: string) => unknown;
}) {
  const t = useTranslations('projects');
  const actionable = props.recovery?.status === 'required' &&
    props.recovery.commandIds.length === 1 && props.onReconcile;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4" role="alert">
      <p className="font-medium">{t('releaseProductionLegacyRecoveryTitle')}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(props.recovery?.status === 'ambiguous'
          ? 'releaseProductionLegacyRecoveryAmbiguousDescription'
          : 'releaseProductionLegacyRecoveryDescription')}
      </p>
      {actionable ? (
        <Button className="mt-3 min-h-11" loading={props.executing}
          disabled={props.executing}
          onClick={() => props.onReconcile?.(props.recovery!.commandIds[0])}>
          {t('releaseProductionLegacyRecoveryReconcileAction')}
        </Button>
      ) : null}
    </div>
  );
}
