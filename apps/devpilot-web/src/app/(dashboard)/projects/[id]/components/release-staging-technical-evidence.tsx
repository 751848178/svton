/**
 * PX-31：技术部署证据的结构化展示。
 * 关键字段（部署地址/制品大小/文件权限/Git 执行/探针状态）提为表单项，
 * 完整 raw JSON 折叠进「查看原始证据」details，不再 18 字段平铺。
 */
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { shortTechnicalId } from '../utils/release-display.utils';

interface Field {
  key: string;
  value: string;
  mono?: boolean;
}

export function ReleaseStagingTechnicalEvidence(props: { result: unknown }) {
  const t = useTranslations('projects');
  const record = asRecord(props.result);
  if (!record) return null;
  const fields: Field[] = [];
  const push = (key: string, value: string, mono?: boolean) => fields.push({ key, value, mono });

  if (typeof record.deploymentUri === 'string' && record.deploymentUri) {
    push('releaseEvidenceDeploymentUri', record.deploymentUri, true);
  }
  if (typeof record.artifactSizeBytes === 'number') {
    push('releaseEvidenceArtifactSize', formatBytes(record.artifactSizeBytes));
  }
  if (typeof record.runtimeEnvironmentFileMode === 'string' && record.runtimeEnvironmentFileMode) {
    push('releaseEvidenceFileMode', record.runtimeEnvironmentFileMode, true);
  }
  if (typeof record.gitInvoked === 'boolean') {
    push('releaseEvidenceGitInvoked', record.gitInvoked ? t('commonYes') : t('commonNo'));
  }
  for (const probe of ['workloadReady', 'healthProbe', 'httpProbe'] as const) {
    const status = asRecord(record[probe])?.status;
    if (typeof status === 'string' && status) {
      push(`releaseEvidenceProbe.${probe}`, String(status));
    }
  }

  return (
    <section className="rounded-md border p-3">
      <h4 className="text-sm font-medium">{t('releaseStagingTechnicalEvidence')}</h4>
      {fields.length > 0 ? (
        <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="min-w-0">
              <dt className="text-muted-foreground">{t(field.key)}</dt>
              <dd className={`mt-0.5 break-all ${field.mono ? 'font-mono' : 'font-medium'}`}>
                {field.key === 'releaseEvidenceArtifactSize'
                  ? field.value
                  : maybeShort(field.value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{t('releaseStagingEvidenceUnavailable')}</p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-primary">
          {t('releaseEvidenceRawToggle')}
        </summary>
        <pre
          data-testid="staging-technical-raw-json"
          className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 font-mono text-xs"
        >
          {JSON.stringify(props.result, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function maybeShort(value: string) {
  return /^c[a-z0-9]{24}$/.test(value) ? shortTechnicalId(value) : value;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return String(bytes);
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB（${bytes} 字节）`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB（${bytes} 字节）`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB（${bytes} 字节）`;
  return `${bytes} 字节`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
