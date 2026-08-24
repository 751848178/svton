/** 站点运行时配置字段 - 按 runtimeType 渲染 static/docker/runtime + TLS 配置。 */
'use client';

import Link from 'next/link';
import React from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, Input, Select } from '@/components/ui';
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
          <Input
            value={formData.rootPath}
            onChange={(event) => onChange({ rootPath: event.target.value })}
            className="font-mono"
            placeholder="/var/www/app.example.com"
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('upstreamAddress')}</label>
            <Input
              value={formData.upstreamUrl}
              onChange={(event) => onChange({ upstreamUrl: event.target.value })}
              className="font-mono"
              placeholder="http://127.0.0.1:3000"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('containerName')}</label>
              <Input
                value={formData.containerName}
                onChange={(event) => onChange({ containerName: event.target.value })}
                placeholder="app"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('containerPort')}</label>
              <Input
                value={formData.containerPort}
                onChange={(event) => onChange({ containerPort: event.target.value })}
                placeholder="3000"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">{t('linkedProxyConfig')}</label>
          <Select
            value={formData.proxyConfigId}
            onChange={(event) => onChange({ proxyConfigId: event.target.value })}
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
          </Select>
          {/* DOM-9：无代理配置时给出创建入口，而不是死路。 */}
          {(proxyConfigs || []).length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('noProxyConfigHint')}{' '}
              <Link
                className="text-primary hover:underline"
                href="/proxy-configs?create=true"
              >
                {t('noProxyConfigCreateLink')}
              </Link>
            </p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('allowedCidr')}</label>
          <Input
            value={formData.allowedCidrs}
            onChange={(event) => onChange({ allowedCidrs: event.target.value })}
            className="font-mono"
            placeholder="10.0.0.0/8, 192.168.0.0/16"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={formData.websocket}
            onChange={(event) => onChange({ websocket: event.target.checked })}
          />
          WebSocket
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={formData.tlsEnabled}
            onChange={(event) => onChange({ tlsEnabled: event.target.checked })}
          />
          {t('enableTls')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={formData.basicAuth}
            onChange={(event) => onChange({ basicAuth: event.target.checked })}
          />
          Basic Auth
        </label>
      </div>

      {/* DOM-6：Basic Auth 凭据（htpasswd）当前不在站点数据模型内，勾选后
          明示凭据来源，不再呈现"可开但无处填"的半成品状态。 */}
      {formData.basicAuth ? (
        <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          {t('basicAuthCredentialNote')}
        </p>
      ) : null}

      {formData.tlsEnabled && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('certType')}</label>
            <Select
              value={formData.tlsType}
              onChange={(event) => onChange({ tlsType: event.target.value })}
            >
              <option value="letsencrypt">Let&apos;s Encrypt</option>
              <option value="custom">{t('customCert')}</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('certEmail')}</label>
            <Input
              value={formData.tlsEmail}
              onChange={(event) => onChange({ tlsEmail: event.target.value })}
              placeholder="ops@example.com"
            />
          </div>
        </div>
      )}
    </>
  );
}
