'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@svton/ui';
import type { SettingsRouteEntryDraft } from './settings-env.model';
import {
  initialRouteEntryForm,
  routeEntryFormError,
  routeEntryFromForm,
  routeTargetKey,
  type RouteEntryForm,
} from './settings-route-entry-editor.model';
import type { SettingsRouteTargetOption } from './settings-route-target-options.model';

interface Props {
  open: boolean;
  environmentName: string;
  targetOptions: SettingsRouteTargetOption[];
  existingEntries?: SettingsRouteEntryDraft[];
  initialEntry?: SettingsRouteEntryDraft | null;
  onClose: () => void;
  onConfirm: (entry: SettingsRouteEntryDraft) => void;
}

export function SettingsEnvEntryModal(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const [form, setForm] = useState<RouteEntryForm>(() =>
    initialRouteEntryForm(props.initialEntry ?? null, props.targetOptions),
  );
  useEffect(() => {
    if (props.open) {
      setForm(initialRouteEntryForm(props.initialEntry ?? null, props.targetOptions));
    }
  }, [props.initialEntry, props.open, props.targetOptions]);
  const existingEntries = props.existingEntries ?? [];
  const error = routeEntryFormError(
    form,
    props.targetOptions,
    existingEntries,
    props.initialEntry ?? null,
  );
  const update = <K extends keyof RouteEntryForm>(key: K, value: RouteEntryForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const confirm = () => {
    const entry = routeEntryFromForm(
      form,
      props.targetOptions,
      existingEntries,
      props.initialEntry ?? null,
    );
    if (!entry) return;
    props.onConfirm(entry);
    props.onClose();
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={t(props.initialEntry ? 'envRoutesEditEntryTitle' : 'envRoutesAddEntryTitle', {
        env: props.environmentName,
      })}
      width={560}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className="min-h-11 rounded-md border px-4 py-2 text-sm hover:bg-accent">
            {tc('cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={Boolean(error)}
            className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t(props.initialEntry ? 'envRoutesSaveEntry' : 'envRoutesAddEntryConfirm')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t('envRoutesModalCallout')}
        </p>
        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t('envRoutesHostLabel')}</span>
          <input
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.domain}
            onChange={(event) => update('domain', event.target.value)}
            placeholder={t('envRoutesHostPlaceholder')}
            aria-invalid={error === 'host'}
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t('envRoutesPathLabel')}</span>
          <input
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
            value={form.path}
            onChange={(event) => update('path', event.target.value)}
            aria-invalid={error === 'path'}
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t('envRoutesTargetLabel')}</span>
          <select
            className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.target}
            onChange={(event) => update('target', event.target.value)}
            aria-invalid={error === 'target'}
          >
            {props.targetOptions.map((option) => (
              <option key={routeTargetKey(option)} value={routeTargetKey(option)}>
                {option.component} : {option.port}
              </option>
            ))}
            <option value="custom">{t('envRoleCustom')} · {t('envRoutesTableComponent')}</option>
          </select>
        </label>
        {form.target === 'custom' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs">
              <span className="font-medium">{t('envRoutesTableComponent')}</span>
              <input className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.customComponent} onChange={(event) => update('customComponent', event.target.value)} aria-invalid={error === 'target'} />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="font-medium">{t('envRoutesPortLabel')}</span>
              <input type="number" min={1} max={65_535} className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.customPort} onChange={(event) => update('customPort', event.target.value)} aria-invalid={error === 'target'} />
            </label>
          </div>
        ) : null}
        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t('envRoutesTlsLabel')}</span>
          <select className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.tlsMode} onChange={(event) => update('tlsMode', event.target.value as RouteEntryForm['tlsMode'])}>
            <option value="managed_cert">{t('envRoutesTlsManaged')}</option>
            <option value="existing_cert_asset">{t('envRoutesTlsExisting')}</option>
          </select>
        </label>
        {error ? <p role="alert" className="text-xs text-red-600">{t(`envRoutesError${error[0].toUpperCase()}${error.slice(1)}`)}</p> : null}
      </div>
    </Modal>
  );
}
