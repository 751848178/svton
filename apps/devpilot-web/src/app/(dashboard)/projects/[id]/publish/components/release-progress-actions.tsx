/**
 * 发布进度页操作区（第 0 步）
 *
 * 单一职责：预发部署成功后的主按钮「发布到生产」（预览弹窗 → 确认），
 * 以及失败/完成后的「回滚到上一版本」（回滚预览 → 确认）。制品自动取
 * 最新成功构建，用户不选择。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { useReleaseProduction } from '../hooks/use-release-production';
import { useReleaseRollback } from '../hooks/use-release-rollback';
import { ProductionConfirmModal } from './production-confirm-modal';
import { RollbackConfirmModal } from './rollback-confirm-modal';

interface Props {
  projectId: string;
  releaseOrderId: string;
  manifestId: string | null;
  canPublishToProduction: boolean;
  canRollback: boolean;
  productionSucceeded: boolean;
  onChanged: () => Promise<unknown> | void;
}

export function ReleaseProgressActions({
  projectId,
  releaseOrderId,
  manifestId,
  canPublishToProduction,
  canRollback,
  productionSucceeded,
  onChanged,
}: Props) {
  const t = useTranslations('projects');
  const [productionOpen, setProductionOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const production = useReleaseProduction(projectId, releaseOrderId, manifestId);
  const rollback = useReleaseRollback(projectId);

  const openProduction = async () => {
    setProductionOpen(true);
    await production.loadPreview();
  };
  const confirmProduction = () =>
    production.confirm().then(async (run) => {
      if (run) await onChanged();
      return run;
    });
  const openRollback = async () => {
    setRollbackOpen(true);
    await rollback.openPreview();
  };
  const confirmRollback = () =>
    rollback.confirm().then(async (run) => {
      if (run) {
        await Promise.all([onChanged(), rollback.reload()]);
      }
      return run;
    });

  const showProduction = canPublishToProduction || productionOpen;
  const showRollback = canRollback || productionSucceeded;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {showProduction ? (
          <Button
            className="min-h-11"
            disabled={!manifestId}
            onClick={() => void openProduction()}
          >
            {t('progressToProduction')}
          </Button>
        ) : null}
        {showRollback ? (
          <Button
            className="min-h-11"
            variant="outline"
            onClick={() => void openRollback()}
          >
            {t('rollbackAction')}
          </Button>
        ) : null}
      </div>
      {production.error && !productionOpen ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {production.error}
        </p>
      ) : null}
      {rollback.error && !rollbackOpen ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {rollback.target ? rollback.error : t('rollbackNoTarget')}
        </p>
      ) : null}
      <ProductionConfirmModal
        open={productionOpen}
        loading={production.loadingPreview}
        confirming={production.confirming}
        error={production.error}
        preview={production.preview}
        onClose={() => setProductionOpen(false)}
        onConfirm={confirmProduction}
      />
      <RollbackConfirmModal
        open={rollbackOpen}
        previewing={rollback.previewing}
        confirming={rollback.confirming}
        error={rollback.target ? rollback.error : t('rollbackNoTarget')}
        preview={rollback.preview}
        onClose={() => setRollbackOpen(false)}
        onConfirm={confirmRollback}
      />
    </>
  );
}
