/**
 * providerState 输入弹窗
 *
 * 单一职责：用结构化弹窗（标题 + Textarea + 校验 + 提交）收集 providerState JSON，
 * 取代原先 reconcileProviderProvisioningRun 里的原生 window.prompt。
 * 校验由 submitReconcileInput 承担（返回错误串则在此内联展示，不关弹窗）。
 */
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Textarea, Modal } from '@/components/ui';

interface ProviderStateModalProps {
  open: boolean;
  onSubmit: (raw: string) => string | null;
  onCancel: () => void;
}

export function ProviderStateModal({ open, onSubmit, onCancel }: ProviderStateModalProps) {
  const t = useTranslations('resourceRequests');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  // 弹窗关闭/重开后清空输入与错误，避免上次残留。
  useEffect(() => {
    if (open) {
      setValue('');
      setError('');
    }
  }, [open]);

  const handleSubmit = () => {
    const err = onSubmit(value);
    if (err) setError(err);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('providerStateTitle')}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {t('providerStateCancel')}
          </Button>
          <Button onClick={handleSubmit}>{t('providerStateSubmit')}</Button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t('providerStateDescription')}</p>
        <Textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError('');
          }}
          placeholder={t('providerStatePlaceholder')}
          rows={10}
          invalid={Boolean(error)}
          autoFocus
          className="font-mono text-xs"
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </Modal>
  );
}
