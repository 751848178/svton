'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui';
import type { EnvironmentResourceBulkBindSelection } from '../../types/environment-copy';
import type { BindableRow, BindableRowGroup } from './resource-bind-rows';

export function ResourceBindGroup({
  group,
  title,
  hint,
  rows,
  selection,
  onToggle,
}: {
  group: BindableRowGroup;
  title: string;
  hint: string;
  rows: BindableRow[];
  selection: EnvironmentResourceBulkBindSelection;
  onToggle: (row: BindableRow, checked: boolean) => void;
}) {
  const t = useTranslations('projects');
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <ul className="max-h-56 space-y-1 overflow-auto">
        {rows.map((row) => {
          const checked = selection[row.selectionKey].includes(row.id);
          return (
            <li key={`${row.selectionKey}:${row.id}`}>
              <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                <Checkbox
                  checked={checked}
                  onChange={(event) => onToggle(row, event.target.checked)}
                />
                <span className="truncate font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">{row.typeName}</span>
                {group === 'inject' && row.injectKeysPreview ? (
                  <span className="ml-auto shrink-0 font-mono text-xs text-primary">
                    → {row.injectKeysPreview}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
      {group === 'inject' && rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('bindGroupInjectableEmpty')}</p>
      ) : null}
    </div>
  );
}
