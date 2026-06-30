/**
 * 密钥卡片
 *
 * 单一职责：渲染单个密钥 + 查看/删除操作，支持展开明文 + 复制。
 */

import { usePersistFn } from '@svton/hooks';
import { Copyable } from '@svton/ui';
import type { SecretKey } from '../types';
import { getKeyTypeInfo } from '../constants';

interface KeyCardProps {
  secretKey: SecretKey;
  revealedValue: string;
  onReveal: (id: string) => void;
  onDelete: (id: string) => void;
}

export function KeyCard({ secretKey, revealedValue, onReveal, onDelete }: KeyCardProps) {
  const typeInfo = getKeyTypeInfo(secretKey.type);
  const isRevealed = Boolean(revealedValue);

  const handleReveal = usePersistFn(() => onReveal(secretKey.id));
  const handleDelete = usePersistFn(() => onDelete(secretKey.id));

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{typeInfo.icon}</span>
          <div>
            <h3 className="font-medium text-gray-900">{secretKey.name}</h3>
            <p className="text-sm text-gray-500">{typeInfo.label}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReveal}
            className="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
          >
            {isRevealed ? '隐藏' : '查看'}
          </button>
          <button
            onClick={handleDelete}
            className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50"
          >
            删除
          </button>
        </div>
      </div>

      {secretKey.description ? (
        <p className="mt-2 text-sm text-gray-500">{secretKey.description}</p>
      ) : null}

      {isRevealed ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <Copyable
            text={revealedValue}
            copyText="复制"
            copiedText="已复制"
          >
            <code className="block break-all text-sm text-gray-800">{revealedValue}</code>
          </Copyable>
        </div>
      ) : null}

      <p className="mt-2 text-xs text-gray-400">
        创建于 {new Date(secretKey.createdAt).toLocaleString()}
      </p>
    </div>
  );
}
