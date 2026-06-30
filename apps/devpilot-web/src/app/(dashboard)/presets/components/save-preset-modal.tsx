/**
 * 保存预设弹窗
 *
 * 单一职责：收集预设名称并提交保存。
 */

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { Modal } from '@/components/ui';

interface SavePresetModalProps {
  open: boolean;
  config: unknown;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export function SavePresetModal({ open, config, onClose, onSave }: SavePresetModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(name);
      onClose();
      setName('');
    } catch (error) {
      console.error('Failed to save preset:', error);
      alert('保存失败');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="保存预设"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">预设名称</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border bg-background px-3 py-2"
            placeholder="如：电商项目模板"
          />
        </label>
        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 transition-colors hover:bg-accent"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
