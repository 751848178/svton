'use client';

import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/ui';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
} from '../types/environment-version.types';

export function EnvironmentUpgradeDialog(props: {
  environment: EnvironmentVersionEnvironment;
  candidate: EnvironmentVersionCandidate;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  const t = useTranslations('projects');
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && props.onClose()}
      tone="warning"
      title={t('environmentVersionUpgradeDialogTitle')}
      description={t('environmentVersionUpgradeDialogDescription', {
        environment: props.environment.name,
        version: props.candidate.releaseOrder.releaseVersion,
        revision: props.candidate.buildRun.revision,
      })}
      consequences={[t('environmentVersionUpgradeDialogConsequence')]}
      confirmLabel={t('environmentVersionUpgradeDialogConfirm')}
      onConfirm={async () => {
        const result = await props.onConfirm();
        if (!result) throw new Error('environment version upgrade failed');
      }}
    />
  );
}
