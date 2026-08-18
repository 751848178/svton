/**
 * 回滚确认弹窗（第 0 步）
 *
 * 单一职责：展示回滚预览（目标版本/制品短 ID/构建来源），确认后触发
 * recovery/confirm。两段式（preview → confirm）与既有恢复弹窗语义一致。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import type { EnvironmentVersionRecoveryPreview } from '../../types/environment-version.types';

interface Props {
  open: boolean;
  previewing: boolean;
  confirming: boolean;
  error: string;
  preview: EnvironmentVersionRecoveryPreview | null;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}

export function RollbackConfirmModal({
  open,
  previewing,
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
      title={t('rollbackPreviewTitle')}
      ariaCloseLabel={tc('cancel')}
      ariaDescriptionId="step0-rollback-confirm"
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
            {t('rollbackConfirmAction')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p
          id="step0-rollback-confirm"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800"
        >
          {t('rollbackConfirmWarning')}
        </p>
        {previewing ? (
          <p className="text-sm text-muted-foreground">{tc('loading')}</p>
        ) : snapshot ? (
          <dl className="grid gap-2 text-sm">
            <Row
              label={t('rollbackEnvironment')}
              value={snapshot.environment.name}
            />
            <Row
              label={t('rollbackVersion')}
              value={snapshot.releaseOrder.releaseVersion}
            />
            <Row
              label={t('rollbackArtifact')}
              value={shortId(snapshot.manifest.digest)}
              mono
            />
            <Row
              label={t('rollbackBuildSource')}
              value={`${snapshot.build.sourceBranch} · ${shortId(snapshot.build.sourceCommitSha)}`}
              mono
            />
          </dl>
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
