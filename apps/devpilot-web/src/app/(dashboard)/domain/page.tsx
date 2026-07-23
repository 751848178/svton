'use client';

import { usePersistFn } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useDomainConfig } from './hooks/use-domain-config';
import { downloadTextFile } from './utils';
import { ConfigForm } from './components/config-form';
import { CodeBlockSection } from './components/code-block-section';

export default function DomainConfigPage() {
  const t = useTranslations('domain');
  const tc = useTranslations('common');
  const {
    config,
    setConfig,
    generatedConfig,
    certbotScript,
    email,
    setEmail,
    validation,
    validateDomain,
    generateNginxConfig,
    generateCertbotScript,
    generatingNginx,
    generatingCertbot,
    error,
    clearError,
  } = useDomainConfig();

  const downloadConfig = usePersistFn(() => {
    downloadTextFile(generatedConfig, `${config.domain}.conf`);
  });
  const downloadCertbot = usePersistFn(() => {
    downloadTextFile(certbotScript, `certbot-${config.domain}.sh`);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConfigForm
          config={config}
          onChange={setConfig}
          email={email}
          onEmailChange={setEmail}
          validation={validation}
          onValidate={validateDomain}
          onGenerateNginx={generateNginxConfig}
          onGenerateCertbot={generateCertbotScript}
          generatingNginx={generatingNginx}
          generatingCertbot={generatingCertbot}
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
          {generatedConfig ? (
            <CodeBlockSection
              title={t('nginxConfig')}
              content={generatedConfig}
              filename={`${config.domain}.conf`}
              onDownload={downloadConfig}
            />
          ) : null}
          {certbotScript ? (
            <CodeBlockSection
              title={t('certbotScript')}
              content={certbotScript}
              filename={`certbot-${config.domain}.sh`}
              onDownload={downloadCertbot}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
