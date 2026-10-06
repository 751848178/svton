export interface SettingsRouteDraft {
  domains: string;
  dnsProvider: string;
  tlsRequired: boolean;
  proxyTarget: string;
  entries: Array<{
    domain: string;
    path: string;
    component: string;
    port: number | null;
    tlsMode: 'none' | 'managed_cert' | 'existing_cert_asset';
  }>;
}

export const EMPTY_SETTINGS_ROUTE: SettingsRouteDraft = {
  domains: '',
  dnsProvider: '',
  tlsRequired: false,
  proxyTarget: '',
  entries: [],
};
