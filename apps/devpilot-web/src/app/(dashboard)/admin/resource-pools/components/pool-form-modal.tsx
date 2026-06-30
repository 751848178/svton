/**
 * 资源池表单弹窗
 *
 * 单一职责：新增/编辑资源池表单。
 */

import { usePersistFn } from '@svton/hooks';
import { Modal } from '@/components/ui';
import type { PoolForm, ResourcePool } from '../types';
import { POOL_TYPES } from '../constants';

interface PoolFormModalProps {
  open: boolean;
  editingPool: ResourcePool | null;
  form: PoolForm;
  onChange: (patch: Partial<PoolForm>) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function PoolFormModal({
  open,
  editingPool,
  form,
  onChange,
  onClose,
  onSubmit,
}: PoolFormModalProps) {
  const handleClose = usePersistFn(() => onClose());
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editingPool ? '编辑资源池' : '添加资源池'}
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">类型</span>
          <select
            value={form.type}
            onChange={(e) => onChange({ type: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            disabled={Boolean(editingPool)}
          >
            {POOL_TYPES.map((t) => (
              <option
                key={t.value}
                value={t.value}
              >
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">名称</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">连接地址</span>
          <input
            type="text"
            value={form.endpoint}
            onChange={(e) => onChange({ endpoint: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="如: mysql://host:3306"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">容量</span>
          <input
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => onChange({ capacity: parseInt(e.target.value, 10) })}
            className="w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
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
