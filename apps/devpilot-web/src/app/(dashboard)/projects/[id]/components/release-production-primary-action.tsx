'use client';

import { useTranslations } from 'next-intl';
import { Button, LinkButton } from '@/components/ui';

interface Props {
  frozen: boolean;
  needsRecovery: boolean;
  legacyRecovery: boolean;
  active: boolean;
  runStatus?: string;
  approvalStatus?: string;
  recoveryHref: string;
  awaitingValidationReady: boolean;
  resuming: boolean;
  snapshotReady: boolean;
  confirming: boolean;
  onRequest: () => void;
  onResume: () => void;
}

export function ReleaseProductionPrimaryAction(props: Props) {
  const t = useTranslations('projects');
  if (props.legacyRecovery) {
    return (
      <div className="max-w-xs text-right">
        <Button className="min-h-11" disabled>
          {t('releaseProductionLegacyRecoveryAction')}
        </Button>
        <p className="mt-1 text-xs text-amber-800" role="status">
          {t('releaseProductionLegacyRecoveryReason')}
        </p>
      </div>
    );
  }
  if (props.needsRecovery) {
    return (
      <LinkButton
        data-primary="true"
        className="min-h-11"
        href={props.recoveryHref}
      >
        {t('releaseProductionRecoveryLink')}
      </LinkButton>
    );
  }
  if (props.active) {
    if (props.runStatus === 'awaiting_validation') {
      if (!props.awaitingValidationReady) {
        return (
          <div className="max-w-xs text-right">
            <Button className="min-h-11" disabled>
              {t('environmentVersionContinueProduction')}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground" role="status">
              {t('releaseProductionResumeCandidateUnavailable')}
            </p>
          </div>
        );
      }
      return (
        <Button
          data-primary="true"
          className="min-h-11"
          loading={props.resuming}
          disabled={!props.awaitingValidationReady || props.resuming}
          onClick={props.onResume}
        >
          {t('environmentVersionContinueProduction')}
        </Button>
      );
    }
    return (
      <Button className="min-h-11" disabled>
        {props.runStatus === 'running'
          ? t('releaseProductionRunningDisabled')
          : props.approvalStatus === 'approved'
            ? t('releaseProductionAwaitingExecuteDisabled')
            : t('releaseProductionAwaitingApprovalDisabled')}
      </Button>
    );
  }
  if (props.frozen) {
    return <Button className="min-h-11" disabled>{t('releaseProductionArtifactFrozen')}</Button>;
  }
  const request = (
    <Button
      data-primary="true"
      className="min-h-11"
      onClick={props.onRequest}
      disabled={!props.snapshotReady || props.confirming}
    >
      {t('requestProductionApproval')}
    </Button>
  );
  if (props.snapshotReady) return request;
  return (
    <div className="max-w-xs text-right">
      {request}
      <p className="mt-1 text-xs text-muted-foreground" role="status">
        {t('releaseProductionSnapshotUnavailable')}
      </p>
    </div>
  );
}
