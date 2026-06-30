/** 站点运行时配置字段 - 按 runtimeType 渲染 static/docker/runtime + TLS 配置。 */

import type { ProxyConfig } from '../types';

interface SiteFormValues {
  runtimeType?: string;
  staticRoot?: string;
  dockerImage?: string;
  dockerComposeFile?: string;
  runtimeCommand?: string;
  runtimePort?: string;
  allowedCidrs?: string;
  websocket?: boolean;
  tlsEnabled?: boolean;
  tlsType?: string;
  tlsEmail?: string;
  proxyConfigId?: string;
  [key: string]: unknown;
}

interface RuntimeConfigFieldsProps {
  formData: SiteFormValues;
  proxyConfigs?: ProxyConfig[];
  onChange: (patch: Record<string, unknown>) => void;
}

export function RuntimeConfigFields({
  formData,
  proxyConfigs,
  onChange,
}: RuntimeConfigFieldsProps) {
  return (
    <>
      {formData.runtimeType === 'static' ? (
        <div>
          <label className="mb-1 block text-sm font-medium">静态目录</label>
          <input
            value={formData.rootPath as string}
            onChange={(event) => onChange({ rootPath: event.target.value })}
            className="w-full rounded-md border px-3 py-2 font-mono text-sm"
            placeholder="/var/www/app.example.com"
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">上游地址</label>
            <input
              value={formData.upstreamUrl as string}
              onChange={(event) => onChange({ upstreamUrl: event.target.value })}
              className="w-full rounded-md border px-3 py-2 font-mono text-sm"
              placeholder="http://127.0.0.1:3000"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium">容器名</label>
              <input
                value={formData.containerName as string}
                onChange={(event) => onChange({ containerName: event.target.value })}
                className="w-full rounded-md border px-3 py-2"
                placeholder="app"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">容器端口</label>
              <input
                value={formData.containerPort as string}
                onChange={(event) => onChange({ containerPort: event.target.value })}
                className="w-full rounded-md border px-3 py-2"
                placeholder="3000"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">关联代理配置</label>
          <select
            value={formData.proxyConfigId as string}
            onChange={(event) => onChange({ proxyConfigId: event.target.value })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">不关联代理配置</option>
            {(proxyConfigs || []).map((config) => (
              <option
                key={config.id}
                value={config.id}
              >
                {config.name} ({config.domain})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">允许 CIDR</label>
          <input
            value={formData.allowedCidrs as string}
            onChange={(event) => onChange({ allowedCidrs: event.target.value })}
            className="w-full rounded-md border px-3 py-2 font-mono text-sm"
            placeholder="10.0.0.0/8, 192.168.0.0/16"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.websocket as boolean}
            onChange={(event) => onChange({ websocket: event.target.checked })}
            className="rounded"
          />
          WebSocket
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.tlsEnabled as boolean}
            onChange={(event) => onChange({ tlsEnabled: event.target.checked })}
            className="rounded"
          />
          启用 TLS
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.basicAuth as boolean}
            onChange={(event) => onChange({ basicAuth: event.target.checked })}
            className="rounded"
          />
          Basic Auth
        </label>
      </div>

      {formData.tlsEnabled && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">证书类型</label>
            <select
              value={formData.tlsType as string}
              onChange={(event) => onChange({ tlsType: event.target.value })}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="letsencrypt">Let&apos;s Encrypt</option>
              <option value="custom">自定义证书</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">证书邮箱</label>
            <input
              value={formData.tlsEmail as string}
              onChange={(event) => onChange({ tlsEmail: event.target.value })}
              className="w-full rounded-md border px-3 py-2"
              placeholder="ops@example.com"
            />
          </div>
        </div>
      )}
    </>
  );
}
