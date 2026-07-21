/**
 * 代理配置详情视图
 *
 * 单一职责：渲染配置基本信息、上游、生成的 Nginx 配置、操作面板。
 */

'use client';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { ProxyConfig } from '../types';

interface ProxyConfigViewProps {
  config: ProxyConfig;
  syncing: boolean;
  onSync: () => void;
  onPreview: () => void;
  onOpenServer: () => void;
}

export function ProxyConfigView({
  config,
  syncing,
  onSync,
  onPreview,
  onOpenServer,
}: ProxyConfigViewProps) {
  const t = useTranslations('proxyConfigs');
  const tc = useTranslations('common');
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-lg border p-6">
          <h2 className="mb-4 font-semibold">{t('basicInfo')}</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Field label={t('domain')}>
              <dd className="font-mono">{config.domain}</dd>
            </Field>
            <Field label="SSL">
              <dd>{config.ssl.enabled ? t('sslEnabledWith', { type: config.ssl.type ?? '' }) : t('notEnabled')}</dd>
            </Field>
            <Field label="WebSocket">
              <dd>{config.websocket ? t('enabled') : t('notEnabled')}</dd>
            </Field>
            <Field label={t('associatedServer')}>
              <dd>{config.server ? config.server.name : t('notAssociated')}</dd>
            </Field>
            {config.project ? (
              <Field label={t('associatedProject')}>
                <dd>{config.project.name}</dd>
              </Field>
            ) : null}
            <Field label={tc('createdAt')}>
              <dd>{new Date(config.createdAt).toLocaleString()}</dd>
            </Field>
          </dl>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="mb-4 font-semibold">{t('upstreamServers')}</h2>
          <div className="space-y-2">
            {config.upstreams.map((upstream, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md bg-muted/50 p-3"
              >
                <span className="font-mono text-sm">
                  {upstream.host}:{upstream.port || 80}
                </span>
                {upstream.weight ? (
                  <span className="text-xs text-muted-foreground">{t('weight', { weight: upstream.weight })}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {config.generatedConfig ? (
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 font-semibold">{t('nginxConfig')}</h2>
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
              {config.generatedConfig}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border p-6">
          <h2 className="mb-4 font-semibold">{tc('actions')}</h2>
          <div className="space-y-2">
            <button
              onClick={onSync}
              disabled={syncing || !config.server}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {syncing ? t('syncing') : t('syncToServer')}
            </button>
            <button
              onClick={onPreview}
              className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t('previewNginx')}
            </button>
            {config.server ? (
              <button
                onClick={onOpenServer}
                className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {t('viewServer')}
              </button>
            ) : null}
          </div>
        </div>
        <StatusBadge status={config.status} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tc = useTranslations('common');
  return (
    <div className="rounded-lg border p-6">
      <h2 className="mb-4 font-semibold">{tc('status')}</h2>
      <StatusTag status={status} />
    </div>
  );
}
