/**
 * 生成密钥弹窗
 *
 * 单一职责：选择类型与长度生成密钥，可复制或转入存储。
 */

import { useState } from 'react';
import { usePersistFn, useSetState } from '@svton/hooks';
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
  const [form, setForm] = useSetState<GenerateKeyInput>({ type: 'jwt_secret', length: 64 });
  const [generatedKey, setGeneratedKey] = useState('');

  const handleGenerate = usePersistFn(async () => {
    try {
      setGeneratedKey(await onGenerate(form));
    } catch (error) {
      console.error('Failed to generate key:', error);
    }
  });

  const handleStorePrefill = usePersistFn(() => {
    onStorePrefill({ type: form.type, value: generatedKey });
    onClose();
    setGeneratedKey('');
  });

  const handleClose = usePersistFn(() => {
    onClose();
    setGeneratedKey('');
  });

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="生成密钥"
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">密钥类型</span>
          <select
            value={form.type}
            onChange={(e) => setForm({ type: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
          >
            {KEY_TYPES.map((t) => (
              <option
                key={t.value}
                value={t.value}
              >
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">长度</span>
          <input
            type="number"
            min={16}
            max={128}
            value={form.length}
            onChange={(e) => setForm({ length: parseInt(e.target.value, 10) })}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>

        <button
          onClick={handleGenerate}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          生成
        </button>

        {generatedKey ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="mb-2 text-sm text-green-800">生成成功！</p>
            <Copyable
              text={generatedKey}
              copyText="复制"
              copiedText="已复制"
            >
              <code className="block break-all rounded bg-white p-2 text-sm">{generatedKey}</code>
            </Copyable>
            <button
              onClick={handleStorePrefill}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              保存到密钥中心 →
            </button>
          </div>
        ) : null}

        <button
          onClick={handleClose}
          className="w-full rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100"
        >
          关闭
        </button>
      </div>
    </Modal>
  );
}
