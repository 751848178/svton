import type { SiteRuntimeType } from '../types';

export interface AddSiteFormData {
  name: string;
  primaryDomain: string;
  aliases: string;
  runtimeType: SiteRuntimeType;
  upstreamUrl: string;
  rootPath: string;
  containerName: string;
  containerPort: string;
  websocket: boolean;
  tlsEnabled: boolean;
  tlsType: string;
  tlsEmail: string;
  allowedCidrs: string;
  basicAuth: boolean;
  serverId: string;
  projectId: string;
  environmentId: string;
  proxyConfigId: string;
}
