'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type { Site } from '@/app/(dashboard)/sites/types';
import type {
  ProjectDomainTarget,
  ProjectDomainWorkflowForm,
} from './project-domain-workflow.model';

export function ProjectDomainWorkflowSteps(props: {
  step: number;
  form: ProjectDomainWorkflowForm;
  targets: ProjectDomainTarget[];
  selectedTarget: ProjectDomainTarget | null;
  projectName: string;
  environmentLabel: string;
  site?: Site | null;
  targetLocked: boolean;
  onChange: (patch: Partial<ProjectDomainWorkflowForm>) => void;
}) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-3 gap-2" aria-label={t('domainWorkflowStepsLabel')}>
        {[1, 2, 3].map((item) => (
          <li
            key={item}
            className={item === props.step
              ? 'rounded-md border border-primary bg-primary/5 px-3 py-2 text-xs font-medium text-primary'
              : 'rounded-md border px-3 py-2 text-xs text-muted-foreground'}
          >
            {item}. {t(`domainWorkflowStep${item}`)}
          </li>
        ))}
      </ol>
      <div className="rounded-md border px-4 py-3 text-sm">
        <p className="font-medium">{props.projectName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('domainWorkflowLockedEnvironment', { environment: props.environmentLabel })}
        </p>
      </div>
      {props.step === 1 ? <TargetStep {...props} /> : null}
      {props.step === 2 ? <DomainStep {...props} /> : null}
      {props.step === 3 ? <PreviewStep {...props} /> : null}
    </div>
  );
}

function TargetStep(props: Parameters<typeof ProjectDomainWorkflowSteps>[0]) {
  const t = useTranslations('projects');
  if (props.targets.length === 0) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">{t('domainWorkflowNoTargetsTitle')}</p>
        <p className="mt-1 text-xs">{t('domainWorkflowNoTargetsDescription')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Field label={t('domainWorkflowTargetLabel')}>
        <Select
          value={props.form.targetKey}
          disabled={props.targetLocked}
          onChange={(event) => props.onChange({ targetKey: event.target.value })}
        >
          <option value="">{t('domainWorkflowTargetPlaceholder')}</option>
          {props.targets.map((target) => (
            <option key={target.key} value={target.key}>
              {target.component} · {target.port}
            </option>
          ))}
        </Select>
      </Field>
      {props.targetLocked ? (
        <p className="text-xs text-muted-foreground">{t('domainWorkflowTargetLocked')}</p>
      ) : null}
      <Field label={t('domainWorkflowPathLabel')}>
        <Input
          value={props.form.path}
          className="font-mono"
          placeholder="/"
          onChange={(event) => props.onChange({ path: event.target.value })}
        />
      </Field>
      {props.selectedTarget ? (
        <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-xs sm:grid-cols-2">
          <Fact label={t('domainWorkflowComponentFact')} value={props.selectedTarget.component} />
          <Fact label={t('domainWorkflowPortFact')} value={String(props.selectedTarget.port)} />
          <Fact label={t('domainWorkflowServerFact')} value={props.selectedTarget.serverLabel ?? t('domainEvidenceUnavailable')} />
          <Fact label={t('domainWorkflowServiceFact')} value={props.selectedTarget.serviceId} mono />
        </div>
      ) : null}
    </div>
  );
}

function DomainStep(props: Parameters<typeof ProjectDomainWorkflowSteps>[0]) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('domainWorkflowNameLabel')}>
          <Input value={props.form.name} onChange={(event) => props.onChange({ name: event.target.value })} />
        </Field>
        <Field label={t('domainColumnDomain')}>
          <Input
            value={props.form.primaryDomain}
            className="font-mono"
            placeholder="app.example.com"
            onChange={(event) => props.onChange({ primaryDomain: event.target.value })}
          />
        </Field>
      </div>
      <Field label={t('domainWorkflowAliasesLabel')}>
        <Input
          value={props.form.aliases}
          className="font-mono"
          placeholder="www.example.com, api.example.com"
          onChange={(event) => props.onChange({ aliases: event.target.value })}
        />
      </Field>
      <Field label={t('domainWorkflowTlsIntentLabel')}>
        <Select
          value={props.form.tlsMode}
          onChange={(event) => props.onChange({ tlsMode: event.target.value as ProjectDomainWorkflowForm['tlsMode'] })}
        >
          <option value="none">{t('domainWorkflowTlsNone')}</option>
          <option value="managed_cert">{t('domainWorkflowTlsManaged')}</option>
          <option value="existing_cert_asset">{t('domainWorkflowTlsExisting')}</option>
        </Select>
      </Field>
      <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
        {t('domainWorkflowTlsTruthHint')}
      </p>
    </div>
  );
}

function PreviewStep(props: Parameters<typeof ProjectDomainWorkflowSteps>[0]) {
  const t = useTranslations('projects');
  const dns = props.site?.dns;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-md border p-4 text-sm sm:grid-cols-2">
        <Fact label={t('domainColumnTarget')} value={`${props.selectedTarget?.component ?? '—'}:${props.selectedTarget?.port ?? '—'}${props.form.path}`} />
        <Fact label={t('domainColumnDomain')} value={props.form.primaryDomain || '—'} mono />
        <Fact label="TLS" value={t(`domainWorkflowTlsMode_${props.form.tlsMode}`)} />
        <Fact label="DNS" value={dns?.status ?? t('domainEvidenceUnavailable')} />
      </div>
      <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        {dns?.checkedAt
          ? t('domainWorkflowDnsObserved', { time: dns.checkedAt })
          : t('domainWorkflowDnsPreviewUnavailable')}
      </p>
      <Field label={t('domainWorkflowReasonLabel')}>
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={props.form.changeReason}
          onChange={(event) => props.onChange({ changeReason: event.target.value })}
        />
      </Field>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium"><span>{props.label}</span>{props.children}</label>;
}

function Fact(props: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-muted-foreground">{props.label}</p><p className={props.mono ? 'mt-1 break-all font-mono' : 'mt-1 break-words'}>{props.value}</p></div>;
}
