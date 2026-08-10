import type { SettingsRouteEntryDraft } from './settings-env.model';
import type { SettingsRouteTargetOption } from './settings-route-target-options.model';

export type RouteEntryForm = {
  domain: string;
  path: string;
  target: string;
  customComponent: string;
  customPort: string;
  tlsMode: SettingsRouteEntryDraft['tlsMode'];
};

export type RouteEntryFormError = 'host' | 'path' | 'target' | 'conflict' | null;

export function initialRouteEntryForm(
  entry: SettingsRouteEntryDraft | null,
  options: SettingsRouteTargetOption[],
): RouteEntryForm {
  const option = entry
    ? options.find(
        (candidate) =>
          candidate.serviceId === entry.serviceId && candidate.port === entry.port,
      )
    : options[0];
  return {
    domain: entry?.domain ?? '',
    path: entry?.path || '/',
    target: option ? routeTargetKey(option) : 'custom',
    customComponent: option ? '' : entry?.component ?? '',
    customPort: option ? '' : entry?.port?.toString() ?? '',
    tlsMode: entry?.tlsMode ?? 'managed_cert',
  };
}

export function routeEntryFormError(
  form: RouteEntryForm,
  options: SettingsRouteTargetOption[],
  existingEntries: SettingsRouteEntryDraft[] = [],
  initialEntry: SettingsRouteEntryDraft | null = null,
): RouteEntryFormError {
  if (!validHost(form.domain.trim())) return 'host';
  if (!validPath(form.path.trim())) return 'path';
  const option = options.find((candidate) => routeTargetKey(candidate) === form.target);
  if (!option && !(validComponent(form.customComponent.trim()) && validPort(Number(form.customPort)))) {
    return 'target';
  }
  const identity = routeEntryIdentity({ domain: form.domain, path: form.path });
  return existingEntries.some(
    (entry) => entry !== initialEntry && routeEntryIdentity(entry) === identity,
  ) ? 'conflict' : null;
}

export function routeEntryFromForm(
  form: RouteEntryForm,
  options: SettingsRouteTargetOption[],
  existingEntries: SettingsRouteEntryDraft[] = [],
  initialEntry: SettingsRouteEntryDraft | null = null,
): SettingsRouteEntryDraft | null {
  if (routeEntryFormError(form, options, existingEntries, initialEntry)) return null;
  const option = options.find((candidate) => routeTargetKey(candidate) === form.target);
  return {
    domain: form.domain.trim().toLowerCase().replace(/\.$/, ''),
    path: normalizedPath(form.path),
    serviceId: option?.serviceId ?? null,
    component: option?.component ?? form.customComponent.trim(),
    port: option?.port ?? Number(form.customPort),
    tlsMode: form.tlsMode,
  };
}

export function routeEntryIdentity(entry: Pick<SettingsRouteEntryDraft, 'domain' | 'path'>) {
  return `${entry.domain.trim().toLowerCase().replace(/\.$/, '')}\u0000${normalizedPath(entry.path)}`;
}

export function upsertRouteEntry(
  entries: SettingsRouteEntryDraft[],
  entry: SettingsRouteEntryDraft,
  previous: SettingsRouteEntryDraft | null,
) {
  const remaining = previous
    ? entries.filter((item) => item !== previous)
    : [...entries];
  if (remaining.some((item) => routeEntryIdentity(item) === routeEntryIdentity(entry))) {
    throw new Error("路由 Host 与 Path 已存在");
  }
  return [...remaining, entry];
}

export function removeRouteEntry(
  entries: SettingsRouteEntryDraft[],
  entry: SettingsRouteEntryDraft,
) {
  const identity = routeEntryIdentity(entry);
  return entries.filter((item) => routeEntryIdentity(item) !== identity);
}

export function routeTargetKey(option: SettingsRouteTargetOption) {
  return `${option.serviceId}:${option.port}`;
}

function normalizedPath(value: string) {
  const path = value.trim() || '/';
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

function validHost(value: string) {
  if (!value || value.length > 253 || /[\s/:?#]/.test(value)) return false;
  return value.replace(/\.$/, '').split('.').every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
  );
}

function validPath(value: string) {
  return value.startsWith('/') && !/[\s?#]/.test(value);
}

function validComponent(value: string) {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(value);
}

function validPort(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 65_535;
}
