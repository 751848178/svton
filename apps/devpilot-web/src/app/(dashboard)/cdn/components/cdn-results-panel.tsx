/**
 * CDN 生成结果面板
 *
 * 单一职责：用 @svton/ui Tabs 展示 5 类生成结果，支持代码下载。
 */

import { Tabs } from '@svton/ui';
import type { CDNResults, CDNProvider } from '../types';
import { downloadTextFile } from '../../domain/utils';

interface CdnResultsPanelProps {
  results: CDNResults;
  provider: CDNProvider;
}

export function CdnResultsPanel({ results, provider }: CdnResultsPanelProps) {
  const hasResults = Boolean(results.urlConfig || results.frontendConfig);

  const items = [
    {
      key: 'url',
      label: 'URL 配置',
      children: results.urlConfig ? (
        <div className="space-y-2">
          {Object.entries(results.urlConfig).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded bg-gray-50 p-2"
            >
              <code className="text-sm text-gray-600">{key}</code>
              <code className="text-sm text-blue-600">{value}</code>
            </div>
          ))}
        </div>
      ) : null,
    },
    {
      key: 'frontend',
      label: '前端配置',
      children: results.frontendConfig ? (
        <CodeBlock
          content={results.frontendConfig}
          filename="cdn.config.ts"
          provider={provider}
        />
      ) : null,
    },
    {
      key: 'refresh',
      label: '刷新脚本',
      children: results.refreshScript ? (
        <CodeBlock
          content={results.refreshScript}
          filename={`cdn-refresh-${provider}.sh`}
          provider={provider}
        />
      ) : null,
    },
    {
      key: 'nextjs',
      label: 'Next.js',
      children: results.nextjsConfig ? (
        <CodeBlock
          content={results.nextjsConfig}
          filename="next.config.cdn.js"
          provider={provider}
        />
      ) : null,
    },
    {
      key: 'env',
      label: '环境变量',
      children: results.envConfig ? (
        <CodeBlock
          content={results.envConfig}
          filename=".env.cdn"
          provider={provider}
        />
      ) : null,
    },
  ];

  if (!hasResults) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="py-12 text-center text-gray-500">填写配置后点击“生成配置”按钮</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <Tabs items={items} />
    </div>
  );
}

function CodeBlock({
  content,
  filename,
}: {
  content: string;
  filename: string;
  provider: CDNProvider;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          onClick={() => downloadTextFile(content, filename)}
          className="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
        >
          下载
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
        {content}
      </pre>
    </div>
  );
}
