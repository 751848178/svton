'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { LogEntry, LogStream } from '@/app/(dashboard)/logs/types-stream';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { DeploymentRun } from '../types/operations';
import { storedDeploymentLogLines } from './project-deployment-evidence.model';
import { DeploymentEvidenceEmpty, ProjectDeploymentEvidenceSection } from './project-deployment-evidence-section';

export function ProjectDeploymentLogs(props: {
  run: DeploymentRun;
  streams: LogStream[];
  entries: LogEntry[];
  error: string;
}) {
  const t = useTranslations('projects');
  const stored = storedDeploymentLogLines(props.run.logs);
  return (
    <ProjectDeploymentEvidenceSection
      title={t('deploymentEvidenceLogs')}
      description={t('deploymentEvidenceLogsDescription')}
    >
      {props.error ? <EvidenceError value={props.error} /> : null}
      {stored.length > 0 ? <LogLines title={t('deploymentEvidenceStoredLogs')} lines={stored} /> : null}
      {props.streams.length > 0 ? <Streams streams={props.streams} /> : null}
      {props.entries.length > 0 ? <Entries entries={props.entries} /> : null}
      {!props.error && stored.length === 0 && props.streams.length === 0 && props.entries.length === 0 ? (
        <DeploymentEvidenceEmpty>{t('deploymentEvidenceNoLogs')}</DeploymentEvidenceEmpty>
      ) : null}
    </ProjectDeploymentEvidenceSection>
  );
}

function LogLines(props: { title: string; lines: Array<{ level: string; message: string }> }) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold">{props.title}</h4>
      <ol className="mt-2 max-h-72 space-y-1 overflow-auto rounded-md bg-slate-950 p-3 font-mono text-xs text-slate-100">
        {props.lines.map((line, index) => (
          <li key={`${index}:${line.message}`} className={line.level === 'error' ? 'text-red-300' : undefined}>
            [{line.level}] {line.message}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Streams({ streams }: { streams: LogStream[] }) {
  const t = useTranslations('projects');
  return (
    <div className="mb-4 space-y-2">
      <h4 className="text-xs font-semibold">{t('deploymentEvidenceStreams')}</h4>
      {streams.map((stream) => (
        <div key={stream.id} className="rounded-md border p-3 text-xs">
          <p className="font-medium">{stream.name}</p>
          <p className="mt-1 text-muted-foreground">{stream.sourceType} · {stream.status}</p>
          <p className="mt-1 break-words">{stream.lastMessage || t('deploymentEvidenceNoStreamEntry')}</p>
        </div>
      ))}
    </div>
  );
}

function Entries({ entries }: { entries: LogEntry[] }) {
  const t = useTranslations('projects');
  return (
    <div>
      <h4 className="text-xs font-semibold">{t('deploymentEvidenceEntries')}</h4>
      <ol className="mt-2 max-h-80 divide-y overflow-auto rounded-md border">
        {entries.map((entry) => (
          <li key={entry.id} className="grid gap-1 p-3 text-xs sm:grid-cols-[120px_64px_1fr]">
            <time className="text-muted-foreground">{formatDateTimeMinute(entry.timestamp)}</time>
            <span className={entry.level === 'error' ? 'font-medium text-destructive' : 'font-medium'}>{entry.level}</span>
            <span className="break-words">{entry.message}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EvidenceError({ value }: { value: string }) {
  const t = useTranslations('projects');
  return <p role="alert" className="mb-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive">{t('deploymentEvidenceLoadFailed')}：{value}</p>;
}
