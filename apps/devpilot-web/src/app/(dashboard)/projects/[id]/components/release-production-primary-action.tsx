'use client';

import { useTranslations } from 'next-intl';
import { Button, LinkButton } from '@/components/ui';

interface Props {
  frozen: boolean;
  needsRecovery: boolean;
  active: boolean;
  runStatus?: string;
  approvalStatus?: string;
  recoveryHref: string;
  snapshotReady: boolean;
  confirming: boolean;
  onRequest: () => void;
}

export function ReleaseProductionPrimaryAction(props: Props) {
  const t = useTranslations('projects');
  if (props.needsRecovery) {
    return (
      <LinkButton
        data-primary="true"
        href={props.recoveryHref}
      >
        {t('releaseProductionRecoveryLink')}
      </LinkButton>
    );
  }
  if (props.active) {
    return (
      <Button disabled>
        {props.runStatus === 'running'
          ? t('releaseProductionRunningDisabled')
          : props.approvalStatus === 'approved'
            ? t('releaseProductionAwaitingExecuteDisabled')
            : t('releaseProductionAwaitingApprovalDisabled')}
      </Button>
    );
  }
  if (props.frozen) return <Button disabled>{t('releaseProductionArtifactFrozen')}</Button>;
  return (
    <Button
      data-primary="true"
      onClick={props.onRequest}
      disabled={!props.snapshotReady || props.confirming}
    >
      {t('requestProductionApproval')}
    </Button>
  );
}
