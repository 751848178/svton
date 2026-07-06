/**
 * CDN 配置详情视图
 *
 * 单一职责：渲染配置基本信息（可编辑）、缓存规则、操作面板。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import type { CDNConfig } from '../types';

const PROVIDERS: Record<string, { label: string; icon: string }> = {
  qiniu: { label: '七牛云', icon: '🌐' },
  aliyun: { label: '阿里云', icon: '☁️' },
  cloudflare: { label: 'Cloudflare', icon: '🛡️' },
};

interface CdnConfigViewProps {
  config: CDNConfig;
  editing: boolean;
  editForm: { name: string; origin: string };
  onEditFormChange: (patch: Partial<{ name: string; origin: string }>) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}

export function CdnConfigView({
  config,
  editing,
  editForm,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSave,
}: CdnConfigViewProps) {
  const t = useTranslations('cdnConfigs');
  const tc = useTranslations('common');
  const provider = PROVIDERS[config.provider] || { label: config.provider, icon: '🌐' };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-lg border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{t('basicInfo')}</h2>
            {!editing ? (
              <button
                onClick={onStartEdit}
                className="text-sm text-primary hover:underline"
              >
                {tc('edit')}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={onCancelEdit}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {tc('cancel')}
                </button>
                <button
                  onClick={onSave}
                  className="text-sm text-primary hover:underline"
                >
                  {tc('save')}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{tc('name')}</span>
                <input
                  value={editForm.name}
                  onChange={(e) => onEditFormChange({ name: e.target.value })}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t('originAddress')}</span>
                <input
                  value={editForm.origin}
                  onChange={(e) => onEditFormChange({ origin: e.target.value })}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label={t('domain')}>
                <dd className="font-mono">{config.domain}</dd>
              </Field>
              <Field label={t('originDomain')}>
                <dd className="font-mono">{config.origin}</dd>
              </Field>
              <Field label={t('provider')}>
                <dd>{provider.label}</dd>
              </Field>
              <Field label={t('credential')}>
                <dd>{config.credential?.name || t('unknown')}</dd>
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
          )}
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="mb-4 font-semibold">{t('cacheRules')}</h2>
          {config.cacheRules && config.cacheRules.length > 0 ? (
            <div className="space-y-2">
              {config.cacheRules.map((rule, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-muted/50 p-3"
                >
                  <span className="font-mono text-sm">{rule.path}</span>
                  <Tag color="default">TTL: {rule.ttl}s</Tag>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('defaultCacheRules')}</p>
          )}
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
