/**
 * Webhook 创建/编辑弹窗
 *
 * 单一职责：收集 name/provider/eventTypes/branchPattern/deploymentMode 并提交。
 * 创建模式额外收集 provider;编辑模式锁定 provider(后端 update 不支持改 provider)
 * 且可切换 enabled。创建成功后一次性回显 setupSecret(仅此一次可见)。
 *
 * 字段对齐后端 CreateProjectWebhookDto / UpdateProjectWebhookDto。
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copyable } from '@svton/ui';
import { ErrorBanner, Input, Modal, Select } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import type {
  CreateWebhookInput,
  UpdateWebhookInput,
} from '../hooks/use-project-webhooks';
import type { ProjectWebhook } from '../types/operations';

const PROVIDER_OPTIONS = [
  { label: 'GitHub', value: 'github' },
  { label: 'GitLab', value: 'gitlab' },
  { label: 'Gitee', value: 'gitee' },
  { label: 'Generic', value: 'generic' },
];

const DEPLOY_MODE_OPTIONS = [
  { label: 'queue', value: 'queue' },
  { label: 'live_request', value: 'live_request' },
  { label: 'preview', value: 'preview' },
  { label: 'dry_run', value: 'dry_run' },
];

export interface WebhookFormModalProps {
  open: boolean;
  projectId: string;
  /** 传入即编辑模式;不传为创建。 */
  editing?: ProjectWebhook | null;
  creating: boolean;
  updating: boolean;
  error: string;
  onClose: () => void;
  onCreate: (input: CreateWebhookInput) => Promise<{ setupSecret?: string } | null>;
  onUpdate: (id: string, input: UpdateWebhookInput) => Promise<boolean>;
  onClearError: () => void;
}

interface FormState {
  name: string;
  provider: string;
  eventTypes: string;
  branchPattern: string;
  deploymentMode: string;
  enabled: boolean;
}

function toForm(hook: ProjectWebhook | null | undefined): FormState {
  if (!hook) {
    return {
      name: '',
      provider: 'github',
      eventTypes: 'push',
      branchPattern: 'main',
      deploymentMode: 'queue',
      enabled: true,
    };
  }
  const events = Array.isArray(hook.eventTypes) ? (hook.eventTypes as string[]) : [];
  return {
    name: hook.name ?? '',
    provider: hook.provider ?? 'github',
    eventTypes: events.length > 0 ? events.join(', ') : 'push',
    branchPattern: hook.branchPattern ?? '',
    deploymentMode: hook.deploymentMode ?? 'queue',
    enabled: hook.enabled,
  };
}

export function WebhookFormModal(props: WebhookFormModalProps) {
  const {
    open,
    projectId,
    editing,
    creating,
    updating,
    error,
    onClose,
    onCreate,
    onUpdate,
    onClearError,
  } = props;
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const isEdit = Boolean(editing);

  const [form, setForm] = useState<FormState>(() => toForm(editing));
  /** 创建成功后一次性回显的明文 secret。 */
  const [revealedSecret, setRevealedSecret] = useState('');

  useEffect(() => {
    if (open) {
      setForm(toForm(editing));
      setRevealedSecret('');
      onClearError();
    }
  }, [editing, open, onClearError]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const parseEventTypes = (text: string): string[] =>
    text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const submit = async () => {
    const eventTypes = parseEventTypes(form.eventTypes);
    if (isEdit && editing) {
      const ok = await onUpdate(editing.id, {
        name: form.name.trim(),
        eventTypes,
        branchPattern: form.branchPattern.trim() || undefined,
        deploymentMode: form.deploymentMode as UpdateWebhookInput['deploymentMode'],
        enabled: form.enabled,
      });
      if (ok) {
        feedback.success(t('webhookUpdated'));
        onClose();
      }
      return;
    }
    const result = await onCreate({
      projectId,
      name: form.name.trim() || undefined,
      provider: form.provider as CreateWebhookInput['provider'],
      eventTypes,
      branchPattern: form.branchPattern.trim() || undefined,
      deploymentMode: form.deploymentMode as CreateWebhookInput['deploymentMode'],
    });
    if (result) {
      feedback.success(t('webhookCreated'));
      if (result.setupSecret) setRevealedSecret(result.setupSecret);
      else onClose();
    }
  };

  const busy = creating || updating;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isEdit ? t('editWebhook') : t('createWebhook')}
    >
      <div className="space-y-4">
        <ErrorBanner message={error} variant="inline" />

        {revealedSecret ? (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
            <p className="text-sm font-medium">{t('webhookSecretOnceTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('webhookSecretOnceHint')}</p>
            <div className="mt-2">
              <Copyable
                text={revealedSecret}
                copyText={t('copyUrlToken')}
                copiedText={t('copied')}
              >
                <code className="block break-all text-xs">{revealedSecret}</code>
              </Copyable>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {tc('confirm')}
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{tc('name')}</span>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={t('webhookNamePlaceholder')}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('providerLabel')}</span>
              <Select
                options={PROVIDER_OPTIONS}
                value={form.provider}
                onChange={(e) => set('provider', e.target.value)}
                disabled={isEdit}
              />
              {isEdit ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t('webhookProviderLocked')}
                </span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('webhookEvents')}</span>
              <Input
                value={form.eventTypes}
                onChange={(e) => set('eventTypes', e.target.value)}
                placeholder={t('webhookEventTypesPlaceholder')}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                {t('webhookEventTypesHint')}
              </span>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('branchLabel')}</span>
              <Input
                value={form.branchPattern}
                onChange={(e) => set('branchPattern', e.target.value)}
                placeholder="main"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('webhookDeploymentMode')}</span>
              <Select
                options={DEPLOY_MODE_OPTIONS}
                value={form.deploymentMode}
                onChange={(e) => set('deploymentMode', e.target.value)}
              />
            </label>

            {isEdit ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => set('enabled', e.target.checked)}
                />
                <span>{t('webhookEnabled')}</span>
              </label>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="min-h-11 rounded-md border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {tc('cancel')}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? tc('processing') : isEdit ? tc('save') : tc('create')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
