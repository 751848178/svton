/**
 * 项目 Webhook 面板。
 *
 * 单一职责:渲染 webhook 列表 + 编排「新建/编辑/轮换密钥/投递记录」弹窗。
 * 行级渲染与脱敏 reveal 抽到 WebhookRow;本组件只持有弹窗开关与变更回调。
 */
'use client';
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { ConfirmDialog, ErrorBanner } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import { PanelGroup } from './panel-group';
import { useProjectWebhooks } from '../hooks/use-project-webhooks';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { ProjectWebhook, WebhookDelivery } from '../types/operations';
import { WebhookFormModal } from './webhook-form-modal';
import { WebhookDeliveriesModal } from './webhook-deliveries-modal';
import { WebhookSecretRevealModal } from './webhook-secret-reveal-modal';
import { WebhookRow } from './webhook-row';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function WebhookPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const hooks = useProjectWebhooks(detail.loadWebhooks);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectWebhook | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ProjectWebhook | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState('');
  const [deliveriesOpen, setDeliveriesOpen] = useState(false);
  const [deliveriesHook, setDeliveriesHook] = useState<ProjectWebhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((hook: ProjectWebhook) => {
    setEditing(hook);
    setFormOpen(true);
  }, []);

  const openDeliveries = useCallback((hook: ProjectWebhook) => {
    setDeliveriesHook(hook);
    setDeliveries([]);
    setDeliveriesOpen(true);
  }, []);

  const loadDeliveriesFor = useCallback(
    async (webhookId: string) => {
      const list = await hooks.loadDeliveries(webhookId);
      setDeliveries(list);
    },
    [hooks],
  );

  const handleRotate = useCallback(async () => {
    if (!rotateTarget) return;
    const secret = await hooks.rotateSecret(rotateTarget.id);
    if (secret) {
      feedback.success(t('webhookRotated'));
      setRotatedSecret(secret);
    }
  }, [hooks, rotateTarget, t]);

  if (detail.webhookError) {
    return (
      <ErrorBanner
        message={detail.webhookError}
        onRetry={() => detail.loadWebhooks()}
      />
    );
  }

  return (
    <PanelGroup
      title={t('webhookTitle')}
      subtitle={t('webhookPanelDescription')}
      actions={
        <button
          type="button"
          onClick={openCreate}
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('createWebhook')}
        </button>
      }
    >
      {detail.webhooks.length === 0 ? (
        <EmptyState text={t('noWebhooks')} />
      ) : (
        <div className="space-y-2">
          {detail.webhooks.map((hook) => (
            <WebhookRow
              key={hook.id}
              hook={hook}
              onEdit={openEdit}
              onRotate={setRotateTarget}
              onShowDeliveries={openDeliveries}
            />
          ))}
        </div>
      )}

      <WebhookFormModal
        open={formOpen}
        projectId={detail.project?.id ?? ''}
        editing={editing}
        creating={hooks.creating}
        updating={hooks.updating}
        error={hooks.createError || hooks.updateError}
        onClose={() => setFormOpen(false)}
        onCreate={hooks.createWebhook}
        onUpdate={hooks.updateWebhook}
        onClearError={hooks.clearCreateError}
      />

      <ConfirmDialog
        open={Boolean(rotateTarget)}
        onOpenChange={(o) => !o && setRotateTarget(null)}
        tone="warning"
        title={t('rotateSecret')}
        description={t('rotateSecretConfirm')}
        confirmLabel={t('rotateSecret')}
        onConfirm={handleRotate}
      />

      <WebhookDeliveriesModal
        open={deliveriesOpen}
        webhook={deliveriesHook}
        loading={hooks.loadingDeliveries}
        deliveries={deliveries}
        onClose={() => setDeliveriesOpen(false)}
        onOpen={loadDeliveriesFor}
      />

      <WebhookSecretRevealModal
        open={Boolean(rotatedSecret)}
        secret={rotatedSecret}
        onClose={() => setRotatedSecret('')}
      />
    </PanelGroup>
  );
}
