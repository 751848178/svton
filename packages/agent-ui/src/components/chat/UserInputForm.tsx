import React, { useMemo, useRef, useState } from 'react';
import { UserInputQuestionField } from './UserInputQuestionField';
import { useDialogFocus } from '../use-dialog-focus';
import type {
  UserInputAnswerPayload,
  UserInputRequestView,
} from './user-input.types';
import { useI18n } from '@svton/ui';

interface UserInputFormProps {
  request: UserInputRequestView;
  onSubmit: (requestId: string, answers: UserInputAnswerPayload) => void;
  onDraftChange?: (requestId: string, questionId: string, value: string) => void;
  onAbort?: () => void;
}

export function UserInputForm({ request, onSubmit, onDraftChange, onAbort }: UserInputFormProps) {
  const { translate: t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleDialogKeyDown = useDialogFocus(dialogRef);
  const [values, setValues] = useState<Record<string, string>>(() => request.draft ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submitting = request.state === 'submitting';
  const titleId = `user-input-${request.requestId}-title`;
  const statusText = request.state === 'submitting'
    ? t('requestInput.status.submitting')
    : request.state === 'error'
      ? t('requestInput.status.failed')
      : t('requestInput.status.waiting');
  const expiryText = useMemo(() => request.autoResolutionMs === undefined
    ? null
    : t('requestInput.expiry'), [request.autoResolutionMs, t]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors: Record<string, string> = {};
    for (const question of request.questions) {
      if (!values[question.id]?.trim()) nextErrors[question.id] = t('requestInput.required');
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const answers = Object.fromEntries(request.questions.map((question) => [
      question.id,
      { answers: [values[question.id].trim()] },
    ]));
    onSubmit(request.requestId, answers);
  };

  return (
    <div ref={dialogRef} className="absolute inset-0 z-30 flex items-center justify-center" role="dialog" aria-labelledby={titleId} onKeyDown={handleDialogKeyDown}>
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <form onSubmit={submit} className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#383838] bg-[#242424] shadow-2xl mx-4">
        <div className="border-b border-[#383838] px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-gray-100">{t('requestInput.title')}</h2>
          <p className="mt-1 text-xs text-gray-400">{t('requestInput.description')}</p>
          {expiryText && <p className="mt-1 text-xs text-amber-300">{expiryText}</p>}
        </div>
        <div className="space-y-5 px-5 py-4">
          {request.questions.map((question) => (
            <UserInputQuestionField
              key={question.id}
              question={question}
              value={values[question.id] ?? ''}
              onChange={(value) => {
                setValues((current) => ({ ...current, [question.id]: value }));
                onDraftChange?.(request.requestId, question.id, value);
                setErrors((current) => ({ ...current, [question.id]: '' }));
              }}
              error={errors[question.id]}
              disabled={submitting}
            />
          ))}
          {request.error && <p role="alert" className="text-sm text-red-400">{request.error}</p>}
          <p aria-live="polite" className="sr-only">{statusText}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#383838] bg-[#171717] px-5 py-3">
          {onAbort && <button type="button" onClick={onAbort} disabled={submitting} className="rounded-lg border border-[#3a3a3a] px-4 py-2 text-sm text-gray-300 disabled:opacity-50">{t('requestInput.stop')}</button>}
          <button type="submit" disabled={submitting} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-50">
            {t(submitting ? 'requestInput.submitting' : 'requestInput.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
