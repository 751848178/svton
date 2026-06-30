/**
 * 代理配置详情域类型
 *
 * 单一职责：仅声明接口。
 */

export interface ProxyConfig {
  id: string;
  name: string;
  domain: string;
  upstreams: Array<{ host: string; port?: number; weight?: number }>;
  ssl: { enabled: boolean; type?: string; certPath?: string; keyPath?: string };
  websocket: boolean;
  status: 'pending' | 'active' | 'error' | string;
  generatedConfig?: string;
  server?: { id: string; name: string; host: string; status: string };
  project?: { id: string; name: string };
  createdBy?: { id: string; name: string | null; email: string };
  createdAt: string;
  updatedAt: string;
}
