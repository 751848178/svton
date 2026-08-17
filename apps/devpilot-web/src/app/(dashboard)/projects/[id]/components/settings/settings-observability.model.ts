export type SettingsObservabilityDraft = {
  profile: '' | 'local_acceptance_v1';
};

export function observabilitySnapshot(profile: SettingsObservabilityDraft['profile']) {
  if (!profile) return {};
  return { version: 1, profile,
    logs: 'local-runtime-logs-v1', metrics: 'local-health-probe-v1',
    traces: 'not-applicable-single-host-v1',
    alerts: 'not-applicable-local-acceptance-v1' };
}
