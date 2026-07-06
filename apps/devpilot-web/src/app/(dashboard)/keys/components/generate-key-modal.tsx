/**
 * 生成密钥弹窗
 *
 * 单一职责：选择类型与长度生成密钥，可复制或转入存储。
 * react-hook-form 样板：取代手写 useSetState + 受控 onChange。
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
import { Copyable } from '@svton/ui';
import { KEY_TYPES } from '../constants';
import type { GenerateKeyInput, KeyInput } from '../types';

interface GenerateKeyModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (input: GenerateKeyInput) => Promise<string>;
  onStorePrefill: (input: Pick<KeyInput, 'type' | 'value'>) => void;
}

export function GenerateKeyModal({
  open,
  onClose,
  onGenerate,
  onStorePrefill,
}: GenerateKeyModalProps) {
  const t = useTranslations('keys');
  const { register, handleSubmit, watch } = useForm<GenerateKeyInput>({
    defaultValues: { type: 'jwt_secret', length: 64 },
  });
  const [generatedKey, setGeneratedKey] = useState('');

  const handleGenerate = async (form: GenerateKeyInput) => {
    try {
      setGeneratedKey(await onGenerate(form));
    } catch (error) {
      console.error('Failed to generate key:', error);
    }
  };

  const handleStorePrefill = () => {
    onStorePrefill({ type: watch('type'), value: generatedKey });
    onClose();
    setGeneratedKey('');
  };

  const handleClose = () => {
    onClose();
    setGeneratedKey('');
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("generate")}
    >
      <form onSubmit={handleSubmit(handleGenerate)} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">{t('keyType')}</span>
          <select
            {...register('type')}
            className="w-full rounded-lg border px-3 py-2"
          >
            {KEY_TYPES.map((kt) => (
              <option
                key={kt.value}
                value={kt.value}
              >
                {kt.icon} {kt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">{t('length')}</span>
          <input
            type="number"
            min={16}
            max={128}
            {...register('length', { valueAsNumber: true })}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {t('generateButton')}
        </button>

        {generatedKey ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="mb-2 text-sm text-green-800">{t('generateSuccess')}</p>
            <Copyable
              text={generatedKey}
              copyText={t('copy')}
              copiedText={t('copied')}
            >
              <code className="block break-all rounded bg-white p-2 text-sm">{generatedKey}</code>
            </Copyable>
            <button
              type="button"
              onClick={handleStorePrefill}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              {t('saveToKeyCenter')}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleClose}
          className="w-full rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100"
        >
          {t('close')}
        </button>
      </form>
    </Modal>
  );
}
