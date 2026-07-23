/**
 * 域名配置表单
 *
 * 单一职责：收集域名/上游/SSL 等参数，触发校验与 Nginx/certbot 生成。
 * 视觉走 token（bg-background / text-foreground / border-input / text-muted-foreground），
 * 校验结果用 StatusTag 语义色，生成按钮统一走 <Button variant="primary">。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { StatusTag } from '@/components/ui';
import type { DomainConfig, SSLMode } from '../types';

interface DomainFormLike {
  domain: string;
  upstream: string;
  upstreamPort: number;
  sslMode: SSLMode;
  enableGzip: boolean;
  enableWebSocket: boolean;
  clientMaxBodySize: number;
}

interface ValidationState {
  isValid: boolean;
  reason?: string;
}

interface ConfigFormProps {
  config: DomainFormLike;
  onChange: (patch: Partial<DomainConfig>) => void;
  email: string;
  onEmailChange: (v: string) => void;
  validation: ValidationState | null;
  onValidate: () => void;
  onGenerateNginx: () => void;
  onGenerateCertbot: () => void;
  generatingNginx?: boolean;
  generatingCertbot?: boolean;
}

/** 数字输入解析：清空时回退空串而非 NaN。 */
function parseIntOrEmpty(raw: string): number | '' {
  if (raw.trim() === '') return '';
  const v = Number.parseInt(raw, 10);
  return Number.isNaN(v) ? '' : v;
}

export function ConfigForm(props: ConfigFormProps) {
  const t = useTranslations('domain');
  const {
    config,
    onChange,
    email,
    onEmailChange,
    validation,
    onValidate,
    onGenerateNginx,
    onGenerateCertbot,
    generatingNginx,
    generatingCertbot,
  } = props;

  return (
    <div className="space-y-4 rounded-lg border bg-background p-6">
      <h2 className="font-semibold text-foreground">{t('configOptions')}</h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted-foreground">{t('domain')}</label>
        <div className="flex gap-2">
          <Input
            value={config.domain}
            onChange={(e) => onChange({ domain: e.target.value })}
            onBlur={onValidate}
            placeholder="example.com"
          />
          {validation ? (
            <StatusTag
              status={validation.isValid ? 'active' : 'error'}
              label={validation.isValid ? t('domainValid') : t('domainInvalid')}
            />
          ) : null}
        </div>
        {validation && !validation.isValid && validation.reason ? (
          <p className="mt-1 text-xs text-destructive">{validation.reason}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">{t('upstreamHost')}</label>
          <Input
            value={config.upstream}
            onChange={(e) => onChange({ upstream: e.target.value })}
            placeholder="http://localhost"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">{t('port')}</label>
          <Input
            type="number"
            value={config.upstreamPort}
            onChange={(e) => {
              const v = parseIntOrEmpty(e.target.value);
              if (v === '') {
                onChange({ upstreamPort: 0 });
              } else {
                onChange({ upstreamPort: v });
              }
            }}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted-foreground">{t('sslMode')}</label>
        <select
          value={config.sslMode}
          onChange={(e) => onChange({ sslMode: e.target.value as SSLMode })}
          className="h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="none">{t('sslNone')}</option>
          <option value="letsencrypt">{t('sslLetsencrypt')}</option>
          <option value="custom">{t('sslCustom')}</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted-foreground">{t('bodySizeLimit')}</label>
        <Input
          type="number"
          value={config.clientMaxBodySize}
          onChange={(e) => {
            const v = parseIntOrEmpty(e.target.value);
            if (v === '') {
              onChange({ clientMaxBodySize: 0 });
            } else {
              onChange({ clientMaxBodySize: v });
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enableGzip}
            onChange={(e) => onChange({ enableGzip: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-muted-foreground">{t('enableGzip')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enableWebSocket}
            onChange={(e) => onChange({ enableWebSocket: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-muted-foreground">{t('enableWebsocket')}</span>
        </label>
      </div>

      <Button
        onClick={onGenerateNginx}
        loading={generatingNginx}
        disabled={!config.domain}
        block
      >
        {t('generateNginx')}
      </Button>

      {config.sslMode === 'letsencrypt' ? (
        <div className="space-y-2 border-t pt-4">
          <label className="block text-sm font-medium text-muted-foreground">{t('letsencryptEmail')}</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="admin@example.com"
          />
          <Button
            onClick={onGenerateCertbot}
            loading={generatingCertbot}
            disabled={!config.domain || !email}
            block
          >
            {t('generateCertbot')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
