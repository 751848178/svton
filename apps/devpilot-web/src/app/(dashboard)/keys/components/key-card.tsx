/**
 * 密钥卡片
 *
 * 单一职责：渲染单个密钥 + 查看/删除操作，支持展开明文 + 复制。
 */

import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('keys');
  const tc = useTranslations('common');
  const typeInfo = getKeyTypeInfo(secretKey.type);
  const isRevealed = Boolean(revealedValue);

  const handleReveal = usePersistFn(() => onReveal(secretKey.id));
  const handleDelete = usePersistFn(() => onDelete(secretKey.id));

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{typeInfo.icon}</span>
          <div>
            <h3 className="font-medium">{secretKey.name}</h3>
            <p className="text-sm text-muted-foreground">{typeInfo.label}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReveal}
            className="rounded px-3 py-1 text-sm text-primary hover:bg-primary/10"
          >
            {isRevealed ? t('hide') : t('reveal')}
          </button>
          <button
            onClick={handleDelete}
            className="rounded px-3 py-1 text-sm text-destructive hover:bg-destructive/10"
          >
            {tc('delete')}
          </button>
        </div>
      </div>

      {secretKey.description ? (
        <p className="mt-2 text-sm text-muted-foreground">{secretKey.description}</p>
      ) : null}

      {isRevealed ? (
        <div className="mt-3 rounded-lg bg-muted/50 p-3">
          <Copyable
            text={revealedValue}
            copyText={t('copy')}
            copiedText={t('copied')}
          >
            <code className="block break-all text-sm">{revealedValue}</code>
          </Copyable>
        </div>
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">
        {t('createdAt', { date: new Date(secretKey.createdAt).toLocaleString() })}
      </p>
    </div>
  );
}
