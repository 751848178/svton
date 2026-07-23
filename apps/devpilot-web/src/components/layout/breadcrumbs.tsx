'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ROUTE_SEGMENT_LABEL_KEYS } from './route-labels';

/** 动态段(如 /projects/[id])展示为前 8 位短 ID,全文放 title。 */
const SHORT_ID_LENGTH = 8;
/** 超过此长度的段才视为「长 ID」候选(短英文单词不截断)。 */
const MIN_ID_LENGTH = 12;
/** 纯数字段长度达到此阈值即视为 ID(如自增主键 1000001)。 */
const MIN_NUMERIC_ID_LENGTH = 5;

/**
 * 判断路由段是否「看起来像动态 ID」(而非漏映射的静态段)。
 * 命中其一即视为 ID:标准 UUID 格式、纯数字主键(长度 ≥ 5)、或长度 ≥ 12 且以数字/混合大小写为主。
 * 漏映射的普通静态段(如 detail/edit/about,短小且全小写单词)不会被误截断。
 */
function isLikelyId(segment: string): boolean {
  // 纯数字主键(自增 id / 短数字 id):长度 ≥ 5 视为 ID,避开极短数字段
  if (/^\d+$/.test(segment) && segment.length >= MIN_NUMERIC_ID_LENGTH) {
    return true;
  }
  if (segment.length < MIN_ID_LENGTH) return false;
  // 标准 / 简写 UUID:8-4-4-4-12 十六进制,或连续 hex/b64 串
  if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(segment)) {
    return true;
  }
  // 长串且含数字或大小写混合(典型数据库 id / nanoid / b64):视为 ID
  const hasDigit = /[0-9]/.test(segment);
  const hasUpper = /[A-Z]/.test(segment);
  return hasDigit || hasUpper;
}

interface BreadcrumbEntry {
  href: string;
  /** 静态段为翻译后的文案或原文;动态段为截断短 ID。 */
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
    // 动态 ID 段:截断短 ID + title 全文
    if (isLikelyId(segment)) {
      return {
        href,
        label:
          segment.length > SHORT_ID_LENGTH
            ? segment.slice(0, SHORT_ID_LENGTH) + '…'
            : segment,
        title: segment,
      };
    }
    // 漏映射的静态段:按原文展示,首字母大写更可读(此前被误当 ID 截断)
    return {
      href,
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
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
