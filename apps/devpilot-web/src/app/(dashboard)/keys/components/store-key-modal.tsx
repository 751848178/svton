/**
 * 存储密钥弹窗
 *
 * 单一职责：收集密钥信息并提交存储。
 */

import { usePersistFn, useSetState } from '@svton/hooks';
import { Modal } from '@/components/ui';
import { KEY_TYPES } from '../constants';
import type { KeyInput } from '../types';

interface StoreKeyModalProps {
  open: boolean;
  initial?: Partial<KeyInput>;
  onClose: () => void;
  onStore: (input: KeyInput) => Promise<void>;
}

export function StoreKeyModal({ open, initial, onClose, onStore }: StoreKeyModalProps) {
  const [form, setForm] = useSetState<KeyInput>({
    name: '',
    type: initial?.type || 'jwt_secret',
    value: initial?.value || '',
    description: '',
  });

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    await onStore(form);
    onClose();
    setForm({ name: '', type: 'jwt_secret', value: '', description: '' });
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="存储密钥"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">名称</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="如: PROD_JWT_SECRET"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">类型</span>
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
          <span className="mb-1 block font-medium text-gray-700">密钥值</span>
          <textarea
            value={form.value}
            onChange={(e) => setForm({ value: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
            rows={3}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">描述（可选）</span>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ description: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="用途说明"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}
