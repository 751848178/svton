/**
 * 技术详情折叠区（单一职责：机器标识与原始证据收进默认收起的 disclosure）。
 * 人做决策用的关键事实留在抽屉主层；这里只承载 ID、digest、内部 URI 等审计证据。
 * 样式为无卡片裸列表：不用边框容器包裹，避免弹层内多层卡片嵌套。
 */
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export interface ReleaseTechnicalDetailItem {
  key: string;
  label: string;
  value: string;
  title?: string;
}

export function ReleaseTechnicalDetails(props: {
  items: ReleaseTechnicalDetailItem[];
  children?: React.ReactNode;
  expanded?: boolean;
}) {
  const t = useTranslations('projects');
  if (!props.items.length && !props.children) return null;
  const content = (
    <>
      {props.items.length > 0 ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {props.items.map((item) => (
            <div
              key={item.key}
              className="min-w-0"
            >
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd
                className="mt-0.5 break-all font-mono"
                title={item.title}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {props.children}
    </>
  );
  if (props.expanded) return <div className="text-xs">{content}</div>;
  return (
    <details
      className="text-xs"
      data-testid="release-technical-details"
    >
      <summary className="cursor-pointer font-medium text-primary">
        {t('releaseRunTechnicalDetails')}
      </summary>
      <div className="mt-3">{content}</div>
    </details>
  );
}
