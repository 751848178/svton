/**
 * CDN 配置表单
 *
 * 单一职责：收集 CDN 配置（提供商/域名/源站/开关）并触发生成。
 * 视觉走 token（bg-background / text-foreground / border-input），不硬编码调色板。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import { Button, Input } from '@/components/ui';
import type { CDNConfig } from '../types';
import { PROVIDERS } from '../constants';

interface CdnConfigFormProps {
  config: CDNConfig;
  onChange: (patch: Partial<CDNConfig>) => void;
  onGenerate: () => void;
  generating?: boolean;
}

export function CdnConfigForm({ config, onChange, onGenerate, generating }: CdnConfigFormProps) {
  const t = useTranslations('cdn');
  return (
    <div className="space-y-4 rounded-lg border bg-background p-6">
      <h2 className="font-semibold text-foreground">{t('configTitle')}</h2>

      <div>
        <label className="mb-2 block text-sm font-medium text-muted-foreground">{t('providerLabel')}</label>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => {
            const selected = config.provider === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange({ provider: p.value })}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-muted'
                }`}
              >
                {selected ? <Tag color="blue">{p.label}</Tag> : <span className="text-sm font-medium text-foreground">{p.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-muted-foreground">{t('cdnDomain')}</span>
        <Input
          value={config.domain}
          onChange={(e) => onChange({ domain: e.target.value })}
          placeholder="cdn.example.com"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-muted-foreground">{t('originDomainLabel')}</span>
        <Input
          value={config.originDomain}
          onChange={(e) => onChange({ originDomain: e.target.value })}
          placeholder="origin.example.com"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-muted-foreground">{t('originPath')}</span>
        <Input
          value={config.originPath}
          onChange={(e) => onChange({ originPath: e.target.value })}
          placeholder="/"
        />
      </label>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enableHttps}
            onChange={(e) => onChange({ enableHttps: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-muted-foreground">{t('enableHttps')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enableCompression}
            onChange={(e) => onChange({ enableCompression: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-muted-foreground">{t('enableCompression')}</span>
        </label>
      </div>

      <Button
        onClick={onGenerate}
        loading={generating}
        disabled={!config.domain || !config.originDomain}
        block
      >
        {t('generateConfig')}
      </Button>
    </div>
  );
}
