/**
 * CDN 生成结果面板
 *
 * 单一职责：用 @svton/ui Tabs 展示 5 类生成结果（URL/前端/刷新/Next.js/环境变量），
 * 代码块统一走 CodeBlock token 原语，URL 配置用结构化 <dl> 展示，支持下载。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Tabs } from '@svton/ui';
import { CodeBlock } from '@/components/ui';
import type { CDNResults, CDNProvider } from '../types';
import { downloadTextFile } from '@/lib/download';

interface CdnResultsPanelProps {
  results: CDNResults;
  provider: CDNProvider;
  error?: string;
}

export function CdnResultsPanel({ results, provider, error }: CdnResultsPanelProps) {
  const t = useTranslations('cdn');
  const hasResults = Boolean(results.urlConfig || results.frontendConfig);

  const items = [
    {
      key: 'url',
      label: t('tabUrlConfig'),
      children: results.urlConfig ? (
        <UrlConfigList urlConfig={results.urlConfig} />
      ) : null,
    },
    {
      key: 'frontend',
      label: t('tabFrontendConfig'),
      children: results.frontendConfig ? (
        <CodeBlock
          content={results.frontendConfig}
          filename="cdn.config.ts"
          tone="dark"
          onDownload={() => downloadTextFile(results.frontendConfig!, 'cdn.config.ts')}
          downloadLabel={t('download')}
        />
      ) : null,
    },
    {
      key: 'refresh',
      label: t('tabRefreshScript'),
      children: results.refreshScript ? (
        <CodeBlock
          content={results.refreshScript}
          filename={`cdn-refresh-${provider}.sh`}
          tone="dark"
          onDownload={() => downloadTextFile(results.refreshScript!, `cdn-refresh-${provider}.sh`)}
          downloadLabel={t('download')}
        />
      ) : null,
    },
    {
      key: 'nextjs',
      label: t('tabNextjs'),
      children: results.nextjsConfig ? (
        <CodeBlock
          content={results.nextjsConfig}
          filename="next.config.cdn.js"
          tone="dark"
          onDownload={() => downloadTextFile(results.nextjsConfig!, 'next.config.cdn.js')}
          downloadLabel={t('download')}
        />
      ) : null,
    },
    {
      key: 'env',
      label: t('tabEnvVars'),
      children: results.envConfig ? (
        <CodeBlock
          content={results.envConfig}
          filename=".env.cdn"
          tone="dark"
          onDownload={() => downloadTextFile(results.envConfig!, '.env.cdn')}
          downloadLabel={t('download')}
        />
      ) : null,
    },
  ];

  if (!hasResults) {
    return (
      <div className="rounded-lg border bg-background p-6">
        {error ? (
          <div className="py-12 text-center text-sm text-destructive">{error}</div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">{t('emptyHint')}</div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Tabs items={items} />
    </div>
  );
}

/** URL 配置结构化展示：键为标签、值为等宽值，逐行成对。 */
function UrlConfigList({ urlConfig }: { urlConfig: Record<string, string> }) {
  const entries = Object.entries(urlConfig);
  return (
    <dl className="divide-y rounded-md border">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-4 px-3 py-2">
          <dt className="font-mono text-sm text-muted-foreground">{key}</dt>
          <dd className="truncate text-right font-mono text-sm text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
