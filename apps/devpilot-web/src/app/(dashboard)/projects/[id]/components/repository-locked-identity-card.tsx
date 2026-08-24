'use client';

import React from 'react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card } from '@svton/ui';
import { Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { feedback } from '@/components/ui/feedback/feedback';
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
  const [confirmReconnect, setConfirmReconnect] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(
    () => setBranch(revision?.defaultBranch || ''),
    [revision?.id, revision?.defaultBranch],
  );
  useEffect(() => {
    if (analysis.error) errorRef.current?.focus();
  }, [analysis.error]);

  // INFO-1：重连是写操作（POST /connect，会更新凭据验证状态并留审计事件），
  // 必须先确认，执行中有 loading，结束有成功/失败 toast，不允许「点了没反应」。
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

  // INFO-8：只读刷新也必须有可感知反馈（loading + 结果 toast）。
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
              variant="secondary"
              onClick={() => setConfirmReconnect(false)}
            >
              {t('repositoryReconnectConfirmCancel')}
            </Button>
            <Button onClick={() => void reconnect()}>{t('repositoryReconnectConfirmAccept')}</Button>
          </div>
        </Modal>
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
        <Field label={t('repositoryBranchRevisionReason')}>
          <Textarea
            className="bg-background"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
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
            loading={analysis.loading}
            onClick={() => void refresh()}
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
