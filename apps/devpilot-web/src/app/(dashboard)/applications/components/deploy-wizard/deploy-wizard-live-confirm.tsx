/**
 * 部署向导 - Step 3：申请 live 部署确认表单
 *
 * 单一职责：收集 confirmationText（必须等于项目名，后端门禁）+ approvalReason，
 * 提交时回调 onSubmit。校验在前端做一道（防误触），后端会再校验一次。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';

interface DeployWizardLiveConfirmProps {
  projectName: string;
  environmentName: string;
  submitting: boolean;
  onSubmit: (confirmationText: string, approvalReason: string) => void;
  onCancel: () => void;
}

export function DeployWizardLiveConfirm({
  projectName,
  environmentName,
  submitting,
  onSubmit,
  onCancel,
}: DeployWizardLiveConfirmProps) {
  const t = useTranslations('applications');
  const tc = useTranslations('common');
  const [confirmationText, setConfirmationText] = useState('');
  const [approvalReason, setApprovalReason] = useState('');

  const confirmed = confirmationText.trim() === projectName.trim();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('wizardLiveHint', { environment: environmentName, project: projectName })}
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('wizardConfirmationLabel')}</span>
        <input
          value={confirmationText}
          onChange={(e) => setConfirmationText(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
          placeholder={projectName}
          autoComplete="off"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('wizardApprovalReasonLabel')}</span>
        <textarea
          value={approvalReason}
          onChange={(e) => setApprovalReason(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
          rows={2}
          placeholder={t('wizardApprovalReasonPlaceholder')}
        />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          {tc('cancel')}
        </Button>
        <Button
          size="sm"
          onClick={() => onSubmit(confirmationText, approvalReason)}
          disabled={!confirmed || submitting}
          title={!confirmed ? t('wizardConfirmationMismatch') : undefined}
        >
          {submitting ? tc('processing') : t('wizardRequestLive')}
        </Button>
      </div>
    </div>
  );
}
