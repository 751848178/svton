'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBoolean } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader } from '@/components/ui';
import { useAuthStore } from '@/store/hooks';
import { useGit } from './hooks/use-git';
import { ConnectionCard } from './components/connection-card';
import { ConnectGitModal } from './components/connect-git-modal';
import { providerNames } from './constants';

export default function GitPage() {
  const t = useTranslations('git');
  const tc = useTranslations('common');
  const { isAuthenticated } = useAuthStore();
  const [modalOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);
  const { connections, repos, selectedProvider, isLoading, loadRepos, connect, disconnect } =
    useGit(isAuthenticated);

  if (!isAuthenticated) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{t('pleaseLogin')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <button
            onClick={openModal}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t('connectAccount')}
          </button>
        }
      />

      <div className="mb-8 mt-8">
        <h2 className="mb-4 text-lg font-medium">{t('connectedAccounts')}</h2>
        {isLoading ? (
          <LoadingState text={tc('loading')} />
        ) : connections.length === 0 ? (
          <EmptyState
            text={t('noConnections')}
            action={
              <button
                onClick={openModal}
                className="text-primary hover:underline"
              >
                {t('connectFirst')}
              </button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.provider}
                connection={conn}
                repos={repos}
                showRepos={selectedProvider === conn.provider}
                onViewRepos={loadRepos}
                onDisconnect={disconnect}
              />
            ))}
          </div>
        )}
      </div>

      {selectedProvider ? (
        <div>
          <h2 className="mb-4 text-lg font-medium">
            {t('providerRepos', { provider: providerNames[selectedProvider] })}
          </h2>
        </div>
      ) : null}

      <ConnectGitModal
        open={modalOpen}
        onClose={closeModal}
        onConnect={connect}
      />
    </div>
  );
}
