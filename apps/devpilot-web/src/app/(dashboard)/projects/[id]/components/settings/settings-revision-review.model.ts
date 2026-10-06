import {
  EMPTY_SETTINGS_ENVIRONMENT_DRAFT,
  type SettingsEnvironmentDraft,
} from './settings-env.model';
import { observabilitySnapshot } from './settings-observability.model';

export type SettingsRevisionArea =
  | 'variables'
  | 'secrets'
  | 'resources'
  | 'access'
  | 'routes'
  | 'observability';

export interface SettingsRevisionChange {
  area: SettingsRevisionArea;
  before: string;
  after: string;
}

type PolicyFact = {
  id: string;
  name?: string;
  effect?: string;
  actions?: unknown;
};

export function buildSettingsRevisionChanges(
  current: SettingsEnvironmentDraft | null,
  next: SettingsEnvironmentDraft,
  policyFacts?: { current?: PolicyFact[]; available?: PolicyFact[] },
): SettingsRevisionChange[] {
  const baseline = current ?? EMPTY_SETTINGS_ENVIRONMENT_DRAFT;
  return [
    change('variables', variableValues(baseline), variableValues(next)),
    change('secrets', secretValues(baseline), secretValues(next)),
    change('resources', resourceValues(baseline), resourceValues(next)),
    change(
      'access',
      accessValues(baseline.policyIds, policyFacts?.current),
      accessValues(next.policyIds, policyFacts?.available),
    ),
    change('routes', routeValues(baseline), routeValues(next)),
    change('observability', observabilityValues(baseline), observabilityValues(next)),
  ].filter((item): item is SettingsRevisionChange => item !== null);
}

function change(area: SettingsRevisionArea, before: string[], after: string[]) {
  const previous = normalized(before);
  const following = normalized(after);
  if (previous === following) return null;
  return { area, before: previous, after: following };
}

function variableValues(draft: SettingsEnvironmentDraft) {
  return Object.entries(draft.plainVariables).map(([key, value]) => `${key}=${value}`);
}

function secretValues(draft: SettingsEnvironmentDraft) {
  return draft.secrets.map((item) => `${item.targetEnvKey} ← ${item.id}`);
}

function resourceValues(draft: SettingsEnvironmentDraft) {
  return draft.resources.map((item) => {
    const shared = [...item.sharedEnvironmentIds].sort().join('|') || '—';
    const bindings =
      (item.envBindings ?? [])
        .map((binding) => `${binding.sourceKey}→${binding.targetEnvKey}`)
        .sort()
        .join('|') || '—';
    return [
      `${item.kind}:${item.id}`,
      `component=${item.componentKey || '—'}`,
      `shared=${shared}`,
      `risk=${item.risk}`,
      `impact=${item.impact || '—'}`,
      `bindings=${bindings}`,
    ].join(' · ');
  });
}

function accessValues(ids: string[], facts: PolicyFact[] | undefined) {
  const byId = new Map((facts ?? []).map((policy) => [policy.id, policy]));
  return ids.map((id) => {
    const policy = byId.get(id);
    if (!policy) return id;
    const actions = Array.isArray(policy.actions) ? policy.actions.join('|') : '—';
    return `${policy.name || id} · ${policy.effect || '—'} · ${actions}`;
  });
}

function routeValues(draft: SettingsEnvironmentDraft) {
  const header = [
    `dns=${draft.route.dnsProvider || '—'}`,
    `proxy=${draft.route.proxyTarget || '—'}`,
    `tlsRequired=${String(draft.route.tlsRequired)}`,
  ].join(' · ');
  return [
    header,
    ...draft.route.entries.map((entry) =>
      [
        `${entry.domain}${entry.path || '/'}`,
        `service=${entry.serviceId || '—'}`,
        `component=${entry.component || '—'}`,
        `port=${entry.port ?? '—'}`,
        `tls=${entry.tlsMode}`,
      ].join(' · '),
    ),
  ];
}

function observabilityValues(draft: SettingsEnvironmentDraft) {
  const snapshot = observabilitySnapshot(draft.observability.profile);
  return Object.entries(snapshot).map(([key, value]) => `${key}=${String(value)}`);
}

function normalized(values: string[]) {
  const result = values.filter(Boolean).sort().join(', ');
  return result || '—';
}
