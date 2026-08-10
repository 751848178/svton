'use client';

import React from 'react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card } from '@svton/ui';
import { Input } from '@/components/ui';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type { ConnectRepositoryInput } from '../types/repository-analysis.types';
import { RepositoryIdentityEvidence } from './repository-identity-evidence';

export function RepositoryLockedIdentityCard({ analysis }: { analysis: RepositoryAnalysisHook }) {
  const t = useTranslations('projects');
  const identity = analysis.state.canonicalIdentity!;
  const revision = identity.effectiveRevision;
  const connection = analysis.state.connection;
  const [branch, setBranch] = useState(revision?.defaultBranch || '');
  const [reason, setReason] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(
    () => setBranch(revision?.defaultBranch || ''),
    [revision?.id, revision?.defaultBranch],
  );
  useEffect(() => {
    if (analysis.error) errorRef.current?.focus();
  }, [analysis.error]);

  const reconnect = async () => {
    if (!connection || !revision) return;
    const input: ConnectRepositoryInput = {
      repositoryUrl: connection.repositoryUrl,
      branch: revision.defaultBranch,
      visibility: connection.visibility,
    };
    const selected = analysis.state.credentialOptions.find((item) => item.id === credentialId);
    if (selected?.source === 'git_connection') input.gitProvider = selected.provider;
    if (selected?.source === 'team_credential') input.teamCredentialId = selected.id;
    await analysis.reconnect(input);
  };

  const revise = async () => {
    if (!revision) return;
    await analysis.reviseBranch({
      branch: branch.trim(),
      reason: reason.trim(),
      expectedRevision: revision.revision,
      idempotencyKey: window.crypto.randomUUID(),
    });
    setReason('');
  };

  const privateCredentialMissing = connection?.visibility === 'private' && !credentialId;
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">{t('repositoryIdentityTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('repositoryIdentityDescription')}</p>
      </div>
      {analysis.error ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="text-sm text-destructive"
        >
          {analysis.error}
        </p>
      ) : null}
      <dl className="grid gap-3 rounded-md border bg-muted/20 p-4 text-sm sm:grid-cols-2">
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityProvider')}
          value={identity.provider}
        />
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityRevision')}
          value={revision ? `R${revision.revision}` : '—'}
        />
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityUrl')}
          value={identity.canonicalUrl}
          wide
        />
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityBranch')}
          value={revision?.defaultBranch || '—'}
        />
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityCommit')}
          value={connection?.commitSha || '—'}
        />
      </dl>
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
          <select
            aria-label={t('repositoryCredentialOption')}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
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
          </select>
        ) : null}
        <Button
          variant="secondary"
          disabled={
            !analysis.state.allowedActions.reconnectCredentials ||
            analysis.mutating ||
            privateCredentialMissing
          }
          onClick={() => void reconnect()}
        >
          {t('repositoryCredentialReconnectAction')}
        </Button>
      </section>
      <section
        className="space-y-3"
        aria-labelledby="repository-branch-heading"
      >
        <h3
          id="repository-branch-heading"
          className="font-medium"
        >
          {t('repositoryBranchRevisionTitle')}
        </h3>
        <Input
          aria-label={t('repositoryIdentityBranch')}
          value={branch}
          onChange={(event) => setBranch(event.target.value)}
        />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('repositoryBranchRevisionReason')}</span>
          <textarea
            className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              !analysis.state.allowedActions.reviseBranch ||
              analysis.mutating ||
              !branch.trim() ||
              reason.trim().length < 8
            }
            onClick={() => void revise()}
          >
            {t('repositoryBranchRevisionAction')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void analysis.load()}
            disabled={analysis.mutating}
          >
            {t('repositoryIdentityRefresh')}
          </Button>
          <Link
            className="inline-flex items-center text-sm underline"
            href={`/audit-events?projectId=${analysis.projectId}&category=repository_analysis`}
          >
            {t('repositoryIdentityAudit')}
          </Link>
        </div>
      </section>
    </Card>
  );
}
