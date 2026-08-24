/**
 * 生产发布确认弹窗（第 0 步）
 *
 * 单一职责：展示「发布到生产」前的差异摘要（环境/版本/制品短 ID/构建来源/
 * 预发验证），确认后触发 POST production-releases。制品短 ID 仅用于报错引用。
 *
 * PX-8：差异摘要数据未就绪（加载失败/无预览）时不再渲染空正文——
 * 给出中性空态说明；确认钮禁用必须带常驻原因文案（非 title-only）。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import { PublishErrorDetail } from './publish-error-detail';

interface Props {
  open: boolean;
  loading: boolean;
  confirming: boolean;
  error: string;
  /** 预览加载失败原因（load 失败不渲染失败 alert，作为空态说明呈现）。 */
  loadError?: string;
  preview: ProductionReleasePreview | null;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}

export function ProductionConfirmModal({
  open,
  loading,
  confirming,
  error,
  loadError,
  preview,
  onClose,
  onConfirm,
}: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const snapshot = preview?.snapshot ?? null;
  const confirmBlockedReason = confirming
    ? t('productionConfirmInProgress')
    : loading
      ? t('productionConfirmLoadingPreview')
      : !snapshot
        ? loadError || t('productionConfirmNoSnapshot')
        : '';

  const handleConfirm = async () => {
    const run = await onConfirm();
    if (run) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('productionPreviewTitle')}
      ariaCloseLabel={tc('cancel')}
      ariaDescriptionId="step0-production-confirm"
      maskClosable={!confirming}
      footer={
        <>
          <Button
            className="min-h-11"
            variant="secondary"
            disabled={confirming}
            onClick={onClose}
          >
            {tc('cancel')}
          </Button>
          <Button
            className="min-h-11"
            loading={confirming}
            disabled={Boolean(confirmBlockedReason)}
            aria-describedby={confirmBlockedReason ? 'step0-production-confirm-blocked' : undefined}
            onClick={() => void handleConfirm()}
          >
            {t('productionConfirmAction')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p
          id="step0-production-confirm"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800"
        >
          {t('productionConfirmWarning')}
        </p>
        {snapshot ? (
          <>
            <dl className="grid gap-2 text-sm">
              <Row
                label={t('productionEnvironment')}
                value={snapshot.environment.name}
              />
              <Row
                label={t('productionVersion')}
                value={snapshot.releaseOrder.releaseVersion}
              />
              <Row
                label={t('productionArtifact')}
                value={shortId(snapshot.manifest.digest)}
                mono
              />
              <Row
                label={t('productionBuildSource')}
                value={`${snapshot.build.sourceBranch} · ${shortId(snapshot.build.sourceCommitSha)}`}
                mono
              />
            </dl>
            <p className="text-xs text-muted-foreground">{t('productionStagingProofNeutral')}</p>
          </>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : (
          <p
            data-testid="production-confirm-empty-state"
            className="rounded-md border bg-muted/30 px-3 py-3 text-sm text-muted-foreground"
          >
            {t('productionConfirmSnapshotUnavailable')}
            {loadError ? (
              <span className="mt-1 block break-all text-xs">{loadError}</span>
            ) : null}
          </p>
        )}
        {confirmBlockedReason ? (
          <p
            id="step0-production-confirm-blocked"
            data-testid="production-confirm-blocked-reason"
            className="text-xs text-muted-foreground"
          >
            {t('productionConfirmDisabledPrefix')}
            {confirmBlockedReason}
          </p>
        ) : null}
        {error ? <PublishErrorDetail raw={error} /> : null}
      </div>
    </Modal>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded bg-muted/40 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-all font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}
