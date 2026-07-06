/** 站点运行时配置字段 - 按 runtimeType 渲染 static/docker/runtime + TLS 配置。 */
'use client';

import { useTranslations } from 'next-intl';
import type { ProxyConfig } from '../types';
import type { AddSiteFormData } from './add-site-form.types';

interface RuntimeConfigFieldsProps {
  formData: AddSiteFormData;
  proxyConfigs?: ProxyConfig[];
  onChange: (patch: Partial<AddSiteFormData>) => void;
}

export function RuntimeConfigFields({
  formData,
  proxyConfigs,
  onChange,
}: RuntimeConfigFieldsProps) {
  const t = useTranslations('sites');
  return (
    <>
      {formData.runtimeType === 'static' ? (
        <div>
          <label className="mb-1 block text-sm font-medium">{t('staticDir')}</label>
          <input
            value={formData.rootPath}
            onChange={(event) => onChange({ rootPath: event.target.value })}
            className="w-full rounded-md border px-3 py-2 font-mono text-sm"
            placeholder="/var/www/app.example.com"
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('upstreamAddress')}</label>
            <input
              value={formData.upstreamUrl}
              onChange={(event) => onChange({ upstreamUrl: event.target.value })}
              className="w-full rounded-md border px-3 py-2 font-mono text-sm"
              placeholder="http://127.0.0.1:3000"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('containerName')}</label>
              <input
                value={formData.containerName}
                onChange={(event) => onChange({ containerName: event.target.value })}
                className="w-full rounded-md border px-3 py-2"
                placeholder="app"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('containerPort')}</label>
              <input
                value={formData.containerPort}
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
          <label className="mb-1 block text-sm font-medium">{t('linkedProxyConfig')}</label>
          <select
            value={formData.proxyConfigId}
            onChange={(event) => onChange({ proxyConfigId: event.target.value })}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">{t('noProxyConfig')}</option>
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
          <label className="mb-1 block text-sm font-medium">{t('allowedCidr')}</label>
          <input
            value={formData.allowedCidrs}
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
            checked={formData.websocket}
            onChange={(event) => onChange({ websocket: event.target.checked })}
            className="rounded"
          />
          WebSocket
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.tlsEnabled}
            onChange={(event) => onChange({ tlsEnabled: event.target.checked })}
            className="rounded"
          />
          {t('enableTls')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.basicAuth}
            onChange={(event) => onChange({ basicAuth: event.target.checked })}
            className="rounded"
          />
          Basic Auth
        </label>
      </div>

      {formData.tlsEnabled && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('certType')}</label>
            <select
              value={formData.tlsType}
              onChange={(event) => onChange({ tlsType: event.target.value })}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="letsencrypt">Let&apos;s Encrypt</option>
              <option value="custom">{t('customCert')}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('certEmail')}</label>
            <input
              value={formData.tlsEmail}
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
