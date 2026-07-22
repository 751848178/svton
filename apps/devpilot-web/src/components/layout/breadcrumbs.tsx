'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ROUTE_SEGMENT_LABEL_KEYS } from './route-labels';

/** 动态段(如 /projects/[id])展示为前 8 位短 ID,全文放 title。 */
const SHORT_ID_LENGTH = 8;

interface BreadcrumbEntry {
  href: string;
  /** 静态段为翻译后的文案,动态段为截断短 ID。 */
  label: string;
  /** 动态段提供完整原文作 title;静态段为 undefined。 */
  title?: string;
}

export function Breadcrumbs() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const segments = pathname.split('/').filter(Boolean);

  // 列表页(单段)不渲染面包屑;二级及以上才渲染
  if (segments.length < 2) {
    return null;
  }

  const entries: BreadcrumbEntry[] = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const labelKey = ROUTE_SEGMENT_LABEL_KEYS[segment];
    if (labelKey) {
      return { href, label: t(labelKey) };
    }
    // 动态段:截断短 ID + title 全文
    return {
      href,
      label:
        segment.length > SHORT_ID_LENGTH
          ? segment.slice(0, SHORT_ID_LENGTH) + '…'
          : segment,
      title: segment,
    };
  });

  return (
    <nav aria-label="breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1;
          return (
            <li key={entry.href} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden="true" className="text-muted-foreground/50">
                  /
                </span>
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  title={entry.title}
                  className="font-medium text-foreground"
                >
                  {entry.label}
                </span>
              ) : (
                <Link
                  href={entry.href}
                  title={entry.title}
                  className="link transition-colors"
                >
                  {entry.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
