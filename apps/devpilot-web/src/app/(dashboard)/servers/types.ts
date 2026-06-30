/**
 * 服务器域类型
 *
 * 单一职责：仅声明接口。
 */

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  status: 'online' | 'offline' | 'unknown';
  tags: string[];
  services: Record<string, boolean>;
  createdAt: string;
  _count?: { proxyConfigs: number };
}

export interface ServerInput {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  credentials: string;
  tags: string[];
}

export interface ConnectionTestResult {
  success: boolean;
  status: string;
  latency: number;
  message: string;
}
