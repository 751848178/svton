'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@svton/ui';
import { Field, Input, Select } from '@/components/ui';
import type { RepositoryAnalysisHook } from '../hooks/use-repository-analysis.hooks';
import type { ConnectRepositoryInput } from '../types/repository-analysis.types';
import { RepositoryIdentityMigrationRequiredCard } from './repository-identity-migration-required-card';
import { RepositoryLockedIdentityCard } from './repository-locked-identity-card';
import { PrivateCredentialFields } from './repository-private-credential-fields';

export function RepositoryConnectCard({
  analysis,
  onRunCreated,
}: {
  analysis: RepositoryAnalysisHook;
  onRunCreated: (runId: string) => void;
}) {
  const connection = analysis.state.connection;
  const [repositoryUrl, setRepositoryUrl] = useState(connection?.repositoryUrl || '');
  const [branch, setBranch] = useState(connection?.selectedBranch || '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    connection?.visibility || 'public',
  );
  const [credentialMode, setCredentialMode] = useState('existing');
  const [credentialId, setCredentialId] = useState('');
  const [credentialName, setCredentialName] = useState('');
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const hydratedSnapshot = useRef('');
  const options = analysis.state.credentialOptions;
  const selectedCredential = useMemo(
    () => options.find((item) => item.id === credentialId),
    [credentialId, options],
  );
  useEffect(() => {
    if (!connection) return;
    const snapshot = `${connection.id}:${connection.repositoryUrl}:${connection.selectedBranch || ''}`;
    if (hydratedSnapshot.current === snapshot) return;
    hydratedSnapshot.current = snapshot;
    setRepositoryUrl(connection.repositoryUrl);
    setBranch(connection.selectedBranch || '');
    setVisibility(connection.visibility);
  }, [connection]);

  if (analysis.state.identityStatus === 'identity_migration_required') {
    return <RepositoryIdentityMigrationRequiredCard />;
  }
  if (analysis.state.canonicalIdentity) {
    return <RepositoryLockedIdentityCard analysis={analysis} />;
  }

  const submit = async () => {
    const input: ConnectRepositoryInput = {
      repositoryUrl: repositoryUrl.trim(),
      branch: branch.trim() || undefined,
      visibility,
    };
    if (visibility === 'private' && credentialMode === 'existing' && selectedCredential) {
      if (selectedCredential.source === 'git_connection') {
        input.gitProvider = selectedCredential.provider;
      } else {
        input.teamCredentialId = selectedCredential.id;
      }
    }
    if (visibility === 'private' && credentialMode.startsWith('inline')) {
      input.credential = {
        type: credentialMode === 'inline-ssh' ? 'ssh_key' : 'https_token',
        name: credentialName.trim(),
        username: username.trim() || undefined,
        secret,
      };
    }
    const run = await analysis.connectAndAnalyze(input);
    onRunCreated(run.id);
  };

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">连接只读代码仓库</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          先验证分支与 commit，再在隔离临时目录解析；不会向仓库写入或执行仓库脚本。
        </p>
      </div>
      {connection ? <ConnectionSnapshot analysis={analysis} /> : null}
      <Field label="仓库地址">
        <Input
          value={repositoryUrl}
          onChange={(event) => setRepositoryUrl(event.target.value)}
          placeholder="https://github.com/org/repo.git"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="分支（可选）">
          <Input
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          />
        </Field>
        <Field label="可见性">
          <Select
            className="bg-background"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'public' | 'private')}
          >
            <option value="public">公开仓库</option>
            <option value="private">私有仓库</option>
          </Select>
        </Field>
      </div>
      {visibility === 'private' ? (
        <PrivateCredentialFields
          mode={credentialMode}
          setMode={setCredentialMode}
          options={options}
          credentialId={credentialId}
          setCredentialId={setCredentialId}
          name={credentialName}
          setName={setCredentialName}
          username={username}
          setUsername={setUsername}
          secret={secret}
          setSecret={setSecret}
        />
      ) : null}
      <Button
        onClick={() => void submit()}
        disabled={!repositoryUrl.trim() || analysis.mutating}
      >
        {analysis.mutating ? '正在验证…' : '连接并解析仓库'}
      </Button>
    </Card>
  );
}

function ConnectionSnapshot({ analysis }: { analysis: RepositoryAnalysisHook }) {
  const item = analysis.state.connection!;
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-medium">
          {item.status === 'connected' ? '已验证连接' : '连接失败'}
        </span>
        <span className="font-mono text-xs">{item.commitSha?.slice(0, 12) || '-'}</span>
      </div>
      <p className="mt-1 break-all text-muted-foreground">
        {item.selectedBranch || '-'} · {item.repositoryUrl}
      </p>
      {item.errorMessage ? <p className="mt-2 text-destructive">{item.errorMessage}</p> : null}
    </div>
  );
}
