/**
 * 策略模式预览
 *
 * 单一职责：展示 Allow/Block 模式列表（最多 4 条）。
 */

'use client';

import { useTranslations } from 'next-intl';

interface PatternPreviewProps {
  allowed: string[];
  blocked: string[];
}

export function PatternPreview({ allowed, blocked }: PatternPreviewProps) {
  if (allowed.length === 0 && blocked.length === 0) return null;
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <PatternList
        title="Allow"
        items={allowed}
      />
      <PatternList
        title="Block"
        items={blocked}
      />
    </div>
  );
}

function PatternList({ title, items }: { title: string; items: string[] }) {
  const t = useTranslations('executionPolicies');
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">{t('patternNone')}</div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 4).map((item) => (
            <code
              key={item}
              className="block break-all rounded bg-muted px-2 py-1 text-xs"
            >
              {item}
            </code>
          ))}
          {items.length > 4 ? (
            <div className="text-xs text-muted-foreground">
              {t('patternMore', { count: items.length - 4 })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
