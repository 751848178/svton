/**
 * 发布进度页操作区（第 0 步）
 *
 * 单一职责：三类操作的入口 ——「部署预发」（构建成功但预发从未开始的中断
 * 恢复口，M2；进行中的预发运行期间禁用，防重复提交）、「发布到生产」
 * （预览弹窗 → 确认，唯一人工闸口）与「回滚到上一版本」（回滚预览 → 确认）。
 * 制品自动取最新成功构建，用户不选择。
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
  /** 有成功制品且预发未完成（含进行中）→ 展示「部署预发」入口（M2）。 */
  showDeployStaging: boolean;
  /** 无进行中的预发运行时才可点（后端不去重，绝不允许双击双发）。 */
  deployStagingEnabled: boolean;
  deployStagingBusy: boolean;
  onDeployStaging: () => void;
  canRollback: boolean;
  productionSucceeded: boolean;
  onChanged: () => Promise<unknown> | void;
}

export function ReleaseProgressActions({
  projectId,
  releaseOrderId,
  manifestId,
  canPublishToProduction,
  showDeployStaging,
  deployStagingEnabled,
  deployStagingBusy,
  onDeployStaging,
  canRollback,
  productionSucceeded,
  onChanged,
}: Props) {
  const t = useTranslations('projects');
  const [productionOpen, setProductionOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const production = useReleaseProduction(projectId, releaseOrderId, manifestId);
  const rollbackOffered = canRollback || productionSucceeded;
  // 版本数据仅在回滚入口实际提供时才拉取（M5）。
  const rollback = useReleaseRollback(projectId, rollbackOffered);

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
    rollback.confirm().then(async (done) => {
      if (done) {
        await Promise.all([onChanged(), rollback.reload()]);
      }
      return done;
    });

  const showProduction = canPublishToProduction || productionOpen;
  const showRollback = rollbackOffered;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {showDeployStaging ? (
          <Button
            className="min-h-11"
            variant="outline"
            loading={deployStagingBusy}
            disabled={!deployStagingEnabled || deployStagingBusy || !manifestId}
            onClick={onDeployStaging}
          >
            {t('progressDeployStaging')}
          </Button>
        ) : null}
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
