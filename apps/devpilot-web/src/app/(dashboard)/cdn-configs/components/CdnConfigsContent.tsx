'use client';

import { useTranslations } from 'next-intl';
import { useBoolean } from '@svton/hooks';
import { LoadingState, EmptyState, Tabs } from '@svton/ui';
import { PageHeader, ErrorBanner, Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useCdnConfigs } from '../hooks/use-cdn-configs';
import { CdnConfigCard } from './cdn-config-card';
import { CredentialTable } from './credential-table';
import { AddCDNConfigModal } from './add-cdn-config-modal';
import { AddCredentialModal } from './add-credential-modal';
import type { CDNConfig, TeamCredential } from '../types';

/**
 * CDN 配置管理客户端视图。
 *
 * 接收首屏 server 数据 initialConfigs / initialCredentials（SWR fallback），
 * 交互（新增配置/凭证、删除、缓存清除）在此完成。
 */
export function CdnConfigsContent({
  initialConfigs,
  initialCredentials,
  initialError,
}: {
  initialConfigs?: CDNConfig[];
  initialCredentials?: TeamCredential[];
  initialError?: string;
}) {
  const t = useTranslations('cdnConfigs');
  const tc = useTranslations('common');
  const {
    configs,
    credentials,
    loading,
    error,
    purgingId,
    configTarget,
    credentialTarget,
    createConfig,
    createCredential,
    purge,
    removeConfig,
    cancelRemoveConfig,
    confirmRemoveConfig,
    removeCredential,
    cancelRemoveCredential,
    confirmRemoveCredential,
    reload,
  } = useCdnConfigs(initialConfigs, initialCredentials, initialError);
  const [configModal, { setTrue: openConfig, setFalse: closeConfig }] = useBoolean(false);
  const [credModal, { setTrue: openCred, setFalse: closeCred }] = useBoolean(false);

  const tabs = [
    {
      key: 'configs',
      label: t('configsTab', { count: configs.length }),
      children: loading ? (
        <LoadingState text={tc('loading')} />
      ) : configs.length === 0 ? (
        <EmptyState
          text={t('noConfigs')}
          description={t('noConfigsHint')}
        />
      ) : (
        <div className="grid gap-4">
          {configs.map((config) => (
            <CdnConfigCard
              key={config.id}
              config={config}
              purging={purgingId === config.id}
              onPurge={purge}
              onDelete={removeConfig}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'credentials',
      label: t('credentialsTab', { count: credentials.length }),
      children: loading ? (
        <LoadingState text={tc('loading')} />
      ) : credentials.length === 0 ? (
        <EmptyState
          text={t('noCredentials')}
          description={t('noCredentialsHint')}
        />
      ) : (
        <CredentialTable
          credentials={credentials}
          onDelete={removeCredential}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={openCred}
            >
              {t('addCredential')}
            </Button>
            <Button onClick={openConfig}>
              {t('addConfigPrefix')}
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={reload}
          retryLabel={tc('retry')}
        />
      ) : null}

      <Tabs items={tabs} />

      <AddCDNConfigModal
        open={configModal}
        credentials={credentials}
        onClose={closeConfig}
        onCreate={createConfig}
      />
      <AddCredentialModal
        open={credModal}
        onClose={closeCred}
        onCreate={createCredential}
      />

      <ConfirmDialog
        open={Boolean(configTarget)}
        onOpenChange={(open) => {
          if (!open) cancelRemoveConfig();
        }}
        tone="danger"
        title={t('deleteConfigTitle')}
        description={
          configTarget ? t('deleteConfigDescription', { name: configTarget.name }) : undefined
        }
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={confirmRemoveConfig}
      />

      <ConfirmDialog
        open={Boolean(credentialTarget)}
        onOpenChange={(open) => {
          if (!open) cancelRemoveCredential();
        }}
        tone="danger"
        title={t('deleteCredentialTitle')}
        description={
          credentialTarget
            ? t('deleteCredentialDescription', { name: credentialTarget.name })
            : undefined
        }
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={confirmRemoveCredential}
      />
    </div>
  );
}
