/**
 * 服务器详情域类型
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
  updatedAt: string;
  createdBy?: { id: string; name: string | null; email: string };
  proxyConfigs?: Array<{ id: string; name: string; domain: string; status: string }>;
}
