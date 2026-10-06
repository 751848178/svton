'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { Modal, Select } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type { ConnectRepositoryInput } from '../types/repository-analysis.types';

export function RepositoryCredentialReconnectControl({
  analysis,
}: {
  analysis: RepositoryAnalysisHook;
}) {
  const t = useTranslations('projects');
  const connection = analysis.state.connection;
  const revision = analysis.state.canonicalIdentity?.effectiveRevision;
  const [credentialId, setCredentialId] = useState('');
  const [confirmReconnect, setConfirmReconnect] = useState(false);
  const reconnect = async () => {
    setConfirmReconnect(false);
    if (!connection || !revision) return;
    const input: ConnectRepositoryInput = {
      repositoryUrl: connection.repositoryUrl,
      branch: revision.defaultBranch,
      visibility: connection.visibility,
    };
    const selected = analysis.state.credentialOptions.find((item) => item.id === credentialId);
    if (selected?.source === 'git_connection') input.gitProvider = selected.provider;
    if (selected?.source === 'team_credential') input.teamCredentialId = selected.id;
    const operation = analysis.reconnect(input);
    feedback.promise(operation, {
      loading: t('repositoryReconnectLoading'),
      success: t('repositoryReconnectSuccess'),
      error: t('repositoryReconnectFailed'),
    });
    await operation.catch(() => undefined);
  };
  const privateCredentialMissing = connection?.visibility === 'private' && !credentialId;
  return (
    <section
      className="space-y-3"
      aria-labelledby="repository-credential-heading"
    >
      <h3
        id="repository-credential-heading"
        className="font-medium"
      >
        {t('repositoryCredentialReconnectTitle')}
      </h3>
      {connection?.visibility === 'private' ? (
        <Select
          aria-label={t('repositoryCredentialOption')}
          className="bg-background"
          value={credentialId}
          onChange={(event) => setCredentialId(event.target.value)}
        >
          <option value="">{t('repositoryCredentialOptionPlaceholder')}</option>
          {analysis.state.credentialOptions.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.label}
            </option>
          ))}
        </Select>
      ) : null}
      <Button
        className="min-h-11 sm:min-h-9"
        variant="secondary"
        loading={analysis.mutating}
        disabled={
          !analysis.state.allowedActions.reconnectCredentials ||
          analysis.mutating ||
          privateCredentialMissing
        }
        onClick={() => setConfirmReconnect(true)}
      >
        {t('repositoryCredentialReconnectAction')}
      </Button>
      <Modal
        open={confirmReconnect}
        onClose={() => setConfirmReconnect(false)}
        title={t('repositoryReconnectConfirmTitle')}
      >
        <p className="text-sm text-muted-foreground">{t('repositoryReconnectConfirmBody')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            className="min-h-11 sm:min-h-9"
            variant="secondary"
            onClick={() => setConfirmReconnect(false)}
          >
            {t('repositoryReconnectConfirmCancel')}
          </Button>
          <Button
            className="min-h-11 sm:min-h-9"
            onClick={() => void reconnect()}
          >
            {t('repositoryReconnectConfirmAccept')}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
