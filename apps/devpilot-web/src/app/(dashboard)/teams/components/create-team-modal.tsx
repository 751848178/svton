/**
 * 创建团队弹窗
 *
 * 单一职责：收集团队名称与描述并提交创建。
 */

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { Modal } from '@/components/ui';

interface CreateTeamModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => Promise<void>;
}

export function CreateTeamModal({ open, onClose, onCreate }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await onCreate(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
      onClose();
    } finally {
      setCreating(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="创建新团队"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            团队名称 <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入团队名称"
            className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">团队描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="输入团队描述（可选）"
            rows={3}
            className="w-full resize-none rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
