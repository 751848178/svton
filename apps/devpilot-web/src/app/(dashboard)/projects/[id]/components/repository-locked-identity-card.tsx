'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { Field, Input, Textarea } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import { RepositoryCredentialReconnectControl } from './repository-credential-reconnect-control';
import { RepositoryIdentityEvidence } from './repository-identity-evidence';

export function RepositoryLockedIdentityCard({ analysis }: { analysis: RepositoryAnalysisHook }) {
  const t = useTranslations('projects');
  const identity = analysis.state.canonicalIdentity!;
  const revision = identity.effectiveRevision;
  const connection = analysis.state.connection;
  const [branch, setBranch] = useState(revision?.defaultBranch || '');
  const [reason, setReason] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(
    () => setBranch(revision?.defaultBranch || ''),
    [revision?.id, revision?.defaultBranch],
  );
  useEffect(() => {
    if (analysis.error) errorRef.current?.focus();
  }, [analysis.error]);

  const refresh = async () => {
    const operation = analysis.load();
    feedback.promise(operation, {
      loading: t('repositoryIdentityRefreshLoading'),
      success: t('repositoryIdentityRefreshSuccess'),
      error: t('repositoryIdentityRefreshFailed'),
    });
    await operation.catch(() => undefined);
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

  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">{t('repositoryIdentityTitle')}</h3>
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
      <dl className="grid gap-x-8 gap-y-3 border-y py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityProvider')}
          value={identity.provider}
        />
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityRevision')}
          value={revision ? `R${revision.revision}` : '—'}
        />
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityBranch')}
          value={revision?.defaultBranch || '—'}
        />
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityUrl')}
          value={identity.canonicalUrl}
          wide
        />
        <RepositoryIdentityEvidence
          label={t('repositoryIdentityCommit')}
          value={connection?.commitSha || '—'}
        />
      </dl>
      <div className="grid gap-6 lg:grid-cols-2 lg:divide-x">
        <RepositoryCredentialReconnectControl analysis={analysis} />
        <section
          className="space-y-3 lg:pl-6"
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
          <Field label={t('repositoryBranchRevisionReason')}>
            <Textarea
              className="bg-background"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11 sm:min-h-9"
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
              className="min-h-11 sm:min-h-9"
              variant="ghost"
              loading={analysis.loading}
              onClick={() => void refresh()}
              disabled={analysis.mutating}
            >
              {t('repositoryIdentityRefresh')}
            </Button>
            <Link
              className="inline-flex min-h-11 items-center text-sm text-primary hover:underline sm:min-h-10"
              href={`/audit-events?projectId=${analysis.projectId}&category=repository_analysis`}
            >
              {t('repositoryIdentityAudit')}
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
