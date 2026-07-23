'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useCdn } from './hooks/use-cdn';
import { CdnConfigForm } from './components/cdn-config-form';
import { CdnResultsPanel } from './components/cdn-results-panel';

export default function CDNConfigPage() {
  const t = useTranslations('cdn');
  const tc = useTranslations('common');
  const { config, setConfig, results, generate, generating, error, clearError } = useCdn();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <Link
            href="/cdn-configs"
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            {t('manageCdnConfigs')} →
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CdnConfigForm
          config={config}
          onChange={setConfig}
          onGenerate={generate}
          generating={generating}
        />
        <div className="space-y-4">
          {error ? (
            <ErrorBanner
              message={error}
              variant="inline"
              onRetry={clearError}
              retryLabel={tc('close')}
            />
          ) : null}
          <CdnResultsPanel
            results={results}
            provider={config.provider}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
