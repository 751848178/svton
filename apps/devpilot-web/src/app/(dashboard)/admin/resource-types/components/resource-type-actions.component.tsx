'use client';

import { useTranslations } from 'next-intl';
import type { ResourceType } from '../types';

interface ResourceTypeActionsProps {
  type: ResourceType;
  onEdit: (type: ResourceType) => void;
  onDisable: (id: string) => void;
}

export function ResourceTypeActions({
  type,
  onEdit,
  onDisable,
}: ResourceTypeActionsProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        onClick={() => onEdit(type)}
        className="inline-flex min-h-9 items-center rounded-md px-3 py-1 text-sm text-primary hover:bg-primary/10"
      >
        {tc('edit')}
      </button>
      {type.enabled ? (
        <button
          onClick={() => onDisable(type.id)}
          className="inline-flex min-h-9 items-center rounded-md px-3 py-1 text-sm text-destructive hover:bg-destructive/10"
        >
          {t('disable')}
        </button>
      ) : null}
    </div>
  );
}
