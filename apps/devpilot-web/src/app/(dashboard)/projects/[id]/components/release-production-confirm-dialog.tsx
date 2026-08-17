'use client';

import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import type { ProductionReleaseSnapshot } from '../types/release-order.types';
import { releaseEnvironmentValueLabelKey } from '../utils/release-copy.model';

interface Props {
  open: boolean;
  onClose: () => void;
  snapshot: ProductionReleaseSnapshot | null;
  confirming: boolean;
  error: string;
  onConfirm: () => Promise<unknown>;
}

export function ReleaseProductionConfirmDialog(props: Props) {
  const t = useTranslations('projects');
  const { open, onClose, snapshot, confirming, error, onConfirm } = props;
  const environmentKey = snapshot
    ? releaseEnvironmentValueLabelKey(snapshot.environment.name)
    : null;
  const environmentLabel = environmentKey ? t(environmentKey) : snapshot?.environment.name || '';
  const resourceCount = snapshot ? snapshotCount(snapshot.config.resourceSnapshot) : null;
  const routeCount = snapshot ? snapshotCount(snapshot.config.routeSnapshot) : null;
  const resourceSummary =
    resourceCount === null
      ? t('releaseProductionNoSnapshot')
      : t('releaseProductionResourceCount', { count: resourceCount });
  const routeSummary =
    routeCount === null
      ? t('releaseProductionNoSnapshot')
      : t('releaseProductionRouteCount', { count: routeCount });

  const handleConfirm = async () => {
    const run = await onConfirm();
    if (run) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('releaseProductionConfirmTitle')}
      ariaCloseLabel={t('releaseGateCancel')}
      ariaDescriptionId="production-release-confirm-warning"
      maskClosable={!confirming}
      footer={(
        <>
          <Button
            className="min-h-11"
            variant="secondary"
            disabled={confirming}
            onClick={onClose}
          >
            {t('releaseGateCancel')}
          </Button>
          <Button
            className="min-h-11"
            loading={confirming}
            disabled={confirming || !snapshot}
            onClick={() => void handleConfirm()}
          >
            {t('releaseProductionConfirmAction')}
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <p id="production-release-confirm-warning" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          {t('releaseProductionConfirmWarning')}
        </p>
        {snapshot ? (
          <dl className="grid gap-2 text-sm">
            <SnapshotRow
              label={t('releaseProductionEnvironment')}
              value={environmentLabel}
              detail={`${snapshot.environment.key} · ${snapshot.environment.baselineRole}`}
            />
            <SnapshotRow
              label={t('releaseProductionVersion')}
              value={snapshot.releaseOrder.releaseVersion}
            />
            <SnapshotRow
              label={t('releaseProductionReuseArtifact')}
              value={`${snapshot.build.id} · R${snapshot.build.revision}`}
              detail={`${snapshot.manifest.id} · ${snapshot.manifest.digest}`}
            />
            <SnapshotRow
              label={t('releaseProductionBuild')}
              value={`R${snapshot.build.revision} · ${snapshot.build.sourceBranch} · ${snapshot.build.sourceCommitSha}`}
            />
            <SnapshotRow
              label={t('releaseProductionConfigSnapshot')}
              value={`R${snapshot.config.revision} · ${snapshot.config.snapshotHash}`}
              detail={`${resourceSummary} · ${routeSummary}`}
            />
            <SnapshotRow
              label={t('releaseProductionReleaseStrategy')}
              value={`${snapshot.releasePolicy.synthetic ? t('releasePolicySynthetic') : `R${snapshot.releasePolicy.revision}`} · ${t('releasePolicyStrategyStandard')} · ${snapshot.releasePolicy.snapshotHash}`}
            />
          </dl>
        ) : null}
        <p className="text-xs text-muted-foreground">{t('releaseProductionStagingProvenNote')}</p>
        {error ? (
          <p
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function SnapshotRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded bg-muted/40 p-3">
      <dt className="font-medium">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">{value}</dd>
      {detail ? (
        <dd className="mt-1 break-all font-mono text-xs text-muted-foreground/75">{detail}</dd>
      ) : null}
    </div>
  );
}

function snapshotCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return null;
}
