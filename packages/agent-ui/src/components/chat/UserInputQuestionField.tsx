import React from 'react';
import type { UserInputQuestionView } from './user-input.types';
import { useI18n } from '@svton/ui';

interface UserInputQuestionFieldProps {
  question: UserInputQuestionView;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled: boolean;
}

export function UserInputQuestionField({
  question,
  value,
  onChange,
  error,
  disabled,
}: UserInputQuestionFieldProps) {
  const { translate: t } = useI18n();
  const descriptionId = `user-input-${question.id}-description`;
  const errorId = `user-input-${question.id}-error`;
  const optionLabels = new Set(question.options?.map((option) => option.label) ?? []);
  const isOther = question.options !== null && question.isOther
    && value.length > 0 && !optionLabels.has(value);
  const describedBy = [descriptionId, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <fieldset className="space-y-2" disabled={disabled} aria-describedby={describedBy}>
      <legend className="text-sm font-medium text-gray-100">{question.header}</legend>
      <p id={descriptionId} className="text-xs text-gray-400">{question.question}</p>
      {question.options ? (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label key={option.label} className="flex items-start gap-2 rounded-lg border border-[#383838] p-2.5">
              <input
                type="radio"
                name={`user-input-${question.id}`}
                value={option.label}
                checked={value === option.label}
                onChange={() => onChange(option.label)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm text-gray-200">{option.label}</span>
                <span className="block text-xs text-gray-500">{option.description}</span>
              </span>
            </label>
          ))}
          {question.isOther && (
            <label className="flex items-center gap-2 rounded-lg border border-[#383838] p-2.5">
              <input
                type="radio"
                name={`user-input-${question.id}`}
                checked={isOther}
                onChange={() => onChange(' ')}
              />
              <span className="text-sm text-gray-200">{t('requestInput.other')}</span>
              <input
                type={question.isSecret ? 'password' : 'text'}
                aria-label={t('requestInput.otherAnswer', { header: question.header })}
                value={isOther ? value.trimStart() : ''}
                onFocus={() => { if (!isOther) onChange(' '); }}
                onChange={(event) => onChange(` ${event.target.value}`)}
                className="min-w-0 flex-1 rounded border border-[#4a4a4a] bg-[#171717] px-2 py-1 text-sm text-gray-100"
              />
            </label>
          )}
        </div>
      ) : (
        <input
          type={question.isSecret ? 'password' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={question.header}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="w-full rounded-lg border border-[#4a4a4a] bg-[#171717] px-3 py-2 text-sm text-gray-100"
        />
      )}
      {error && <p id={errorId} role="alert" className="text-xs text-red-400">{error}</p>}
    </fieldset>
  );
}
