/**
 * 代理配置域类型
 *
 * 单一职责：仅声明接口。
 */

export interface ProxyConfig {
  id: string;
  name: string;
  domain: string;
  upstreams: Array<{ host: string; port?: number }>;
  ssl: { enabled: boolean; type?: string };
  websocket: boolean;
  status: 'pending' | 'active' | 'error' | string;
  server?: { id: string; name: string; host: string; status: string };
  project?: { id: string; name: string };
  createdAt: string;
}

export interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

export interface ProxyConfigInput {
  name: string;
  domain: string;
  upstreamHost: string;
  upstreamPort: number;
  sslEnabled: boolean;
  sslType: 'letsencrypt' | 'custom' | 'none';
  websocket: boolean;
  serverId: string;
}
