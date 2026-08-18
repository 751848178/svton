/**
 * 生产发布确认弹窗（第 0 步）
 *
 * 单一职责：展示「发布到生产」前的差异摘要（环境/版本/制品短 ID/构建来源/
 * 预发验证），确认后触发 POST production-releases。制品短 ID 仅用于报错引用。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import type { ProductionReleasePreview } from '../../types/release-production.types';

interface Props {
  open: boolean;
  loading: boolean;
  confirming: boolean;
  error: string;
  preview: ProductionReleasePreview | null;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}

export function ProductionConfirmModal({
  open,
  loading,
  confirming,
  error,
  preview,
  onClose,
  onConfirm,
}: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const snapshot = preview?.snapshot ?? null;

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
            disabled={confirming || !snapshot}
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
        {loading ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : snapshot ? (
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
        ) : null}
        {snapshot ? (
          <p className="text-xs text-muted-foreground">{t('productionStagingProof')}</p>
        ) : null}
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
