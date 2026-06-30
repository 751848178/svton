'use client';

import { PageHeader } from '@/components/ui';
import { useCdn } from './hooks/use-cdn';
import { CdnConfigForm } from './components/cdn-config-form';
import { CdnResultsPanel } from './components/cdn-results-panel';

export default function CDNConfigPage() {
  const { config, setConfig, results, generate } = useCdn();

  return (
    <div className="space-y-6">
      <PageHeader
        title="CDN 配置"
        description="生成 CDN 相关配置和刷新脚本"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CdnConfigForm
          config={config}
          onChange={setConfig}
          onGenerate={generate}
        />
        <CdnResultsPanel
          results={results}
          provider={config.provider}
        />
      </div>
    </div>
  );
}
import type { Tabs } from '@svton/ui'; // @svton/ui type reference
