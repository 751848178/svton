/**
 * Webhook 明文密钥一次性展示弹窗
 *
 * 单一职责:创建 / 轮换密钥成功后,把仅此一次可见的明文 secret 安全地
 * 呈现给用户(脱敏 toast 会泄露/不够用,这里在受控 Modal 内回显 + 复制)。
 * 关闭后不再保留;调用方应在关闭时清空 secret。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Copyable } from '@svton/ui';
import { Modal } from '@/components/ui';

export interface WebhookSecretRevealModalProps {
  open: boolean;
  secret: string;
  onClose: () => void;
}

export function WebhookSecretRevealModal({ open, secret, onClose }: WebhookSecretRevealModalProps) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  if (!secret) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('webhookSecretOnceTitle')}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('webhookSecretOnceHint')}</p>
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
          <Copyable text={secret} copyText={t('copyUrlToken')} copiedText={t('copied')}>
            <code className="block break-all text-xs">{secret}</code>
          </Copyable>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {tc('confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
