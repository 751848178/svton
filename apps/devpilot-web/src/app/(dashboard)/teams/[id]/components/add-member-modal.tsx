/**
 * 添加成员弹窗
 *
 * 单一职责：收集成员邮箱与角色并提交。
 */

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { Modal } from '@/components/ui';
import type { MemberRole } from '@/store/hooks';

interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (email: string, role: MemberRole) => Promise<void>;
}

export function AddMemberModal({ open, onClose, onAdd }: AddMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [adding, setAdding] = useState(false);

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      await onAdd(email.trim(), role);
      setEmail('');
      setRole('member');
      onClose();
    } finally {
      setAdding(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="添加成员"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            邮箱地址 <span className="text-destructive">*</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="输入成员邮箱"
            className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">角色</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="member">成员</option>
            <option value="admin">管理员</option>
          </select>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {adding ? '添加中...' : '添加'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
