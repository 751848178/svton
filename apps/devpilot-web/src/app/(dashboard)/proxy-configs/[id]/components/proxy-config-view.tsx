/**
 * 代理配置详情视图
 *
 * 单一职责：渲染配置基本信息、上游、生成的 Nginx 配置、操作面板。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Button, CodeBlock } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
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
            <Field label={t('sslLabel')}>
              <dd>{config.ssl.enabled ? t('sslEnabledWith', { type: config.ssl.type ?? '' }) : t('notEnabled')}</dd>
            </Field>
            <Field label={t('websocketLabel')}>
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
              <dd>{formatDateTime(config.createdAt)}</dd>
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
                  {upstream.host}
                  {upstream.port ? (
                    `:${upstream.port}`
                  ) : (
                    <span className="text-muted-foreground/60">:{t('portNotSet')}</span>
                  )}
                </span>
                {upstream.weight ? (
                  <span className="text-xs text-muted-foreground">{t('weight', { weight: upstream.weight })}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {config.generatedConfig ? (
          <div className="space-y-2">
            <h2 className="font-semibold">{t('nginxConfig')}</h2>
            <CodeBlock content={config.generatedConfig} tone="dark" />
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border p-6">
          <h2 className="mb-4 font-semibold">{tc('actions')}</h2>
          <div className="space-y-2">
            <Button
              onClick={onSync}
              disabled={syncing || !config.server}
              block
            >
              {syncing ? t('syncing') : t('syncToServer')}
            </Button>
            <Button
              variant="outline"
              onClick={onPreview}
              block
            >
              {t('previewNginx')}
            </Button>
            {config.server ? (
              <Button
                variant="outline"
                onClick={onOpenServer}
                block
              >
                {t('viewServer')}
              </Button>
            ) : null}
          </div>
        </div>
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
