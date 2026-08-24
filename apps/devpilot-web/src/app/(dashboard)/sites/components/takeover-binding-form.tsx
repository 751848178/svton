/** 站点接管绑定表单 - 目标服务器/上游/TLS 配置。 */
'use client';
import { useTranslations } from 'next-intl';
import { Checkbox, Input, Select } from '@/components/ui';
import { usePersistFn } from '@svton/hooks';
import type { Server, SiteTakeoverForm } from '../types';
import { readString } from '../utils';
import { formatTlsAssetLabel } from '../utils-format';

interface TakeoverBindingFormProps {
  siteName: string;
  primaryDomain: string;
  isPreviewPlaceholder: boolean;
  form: SiteTakeoverForm;
  servers: Server[];
  tlsAssets: Record<string, unknown>[];
  savingTakeover: boolean;
  activatingPreview: boolean;
  queueSiteRuns: boolean;
  onUpdate: (patch: Partial<SiteTakeoverForm>) => void;
  onSave: () => void;
  onActivatePreview: () => void;
}

export function TakeoverBindingForm(props: TakeoverBindingFormProps) {
  const t = useTranslations('sites');
  const {
    form,
    servers,
    tlsAssets,
    savingTakeover,
    activatingPreview,
    queueSiteRuns,
    onUpdate,
    onSave,
    onActivatePreview,
    siteName,
    primaryDomain,
    isPreviewPlaceholder,
  } = props;
  const handleSave = usePersistFn(() => onSave());
  const handleActivate = usePersistFn(() => onActivatePreview());
  return (
    <div className="mt-4 rounded-md border bg-background p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{t('takeoverBinding')}</div>
        <button
          type="button"
          onClick={handleSave}
          disabled={savingTakeover}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingTakeover ? t('saving') : t('saveBinding')}
        </button>
        {isPreviewPlaceholder ? (
          <button
            type="button"
            onClick={handleActivate}
            disabled={activatingPreview}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activatingPreview
              ? queueSiteRuns
                ? t('takeoverEnqueuing')
                : t('takingOver')
              : queueSiteRuns
                ? t('takeoverPreviewEnqueue')
                : t('takeoverPreviewPlan')}
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('targetServer')}</span>
          <Select
            value={form.serverId}
            onChange={(e) => onUpdate({ serverId: e.target.value })}
          >
            <option value="">{t('noServer')}</option>
            {servers.map((s) => (
              <option
                key={s.id}
                value={s.id}
              >
                {s.name} ({s.host})
              </option>
            ))}
          </Select>
        </label>
        {isPreviewPlaceholder ? (
          <>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('previewUpstream')}
              </span>
              <Input
                value={form.upstreamUrl}
                onChange={(e) => onUpdate({ upstreamUrl: e.target.value })}
                className="font-mono"
                placeholder="http://127.0.0.1:3042"
              />
            </label>
            <label className="flex items-end">
              <span className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Checkbox
                  checked={form.websocket}
                  onChange={(e) => onUpdate({ websocket: e.target.checked })}
                />
                WebSocket
              </span>
            </label>
          </>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('tlsType')}</span>
          <Select
            value={form.tlsType}
            onChange={(e) => onUpdate({ tlsType: e.target.value })}
            disabled={!form.tlsEnabled}
            className="disabled:bg-muted disabled:text-muted-foreground"
          >
            <option value="letsencrypt">Let&apos;s Encrypt</option>
            <option value="custom">{t('customCert')}</option>
          </Select>
        </label>
        <label className="flex items-end">
          <span className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Checkbox
              checked={form.tlsEnabled}
              onChange={(e) => onUpdate({ tlsEnabled: e.target.checked })}
            />
            {t('enableTls')}
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('certEmail')}</span>
          <Input
            value={form.tlsEmail}
            onChange={(e) => onUpdate({ tlsEmail: e.target.value })}
            disabled={!form.tlsEnabled || form.tlsType !== 'letsencrypt'}
            className="disabled:bg-muted disabled:text-muted-foreground"
            placeholder="ops@example.com"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('certName')}</span>
          <Input
            value={form.tlsCertName}
            onChange={(e) => onUpdate({ tlsCertName: e.target.value })}
            disabled={!form.tlsEnabled}
            className="disabled:bg-muted disabled:text-muted-foreground"
            placeholder={primaryDomain}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('obsCertAsset')}</span>
          <Select
            value={form.tlsAssetId}
            onChange={(e) => onUpdate({ tlsAssetId: e.target.value })}
            disabled={!form.tlsEnabled || tlsAssets.length === 0}
            className="disabled:bg-muted disabled:text-muted-foreground"
          >
            {tlsAssets.length === 0 ? (
              <option value="">{t('noBindableAsset')}</option>
            ) : (
              <>
                <option value="">{t('noObsAsset')}</option>
                {tlsAssets.map((asset, index) => {
                  const assetId = readString(asset.id) || 'asset-' + index;
                  return (
                    <option
                      key={assetId}
                      value={assetId}
                    >
                      {formatTlsAssetLabel(asset)}
                    </option>
                  );
                })}
              </>
            )}
          </Select>
        </label>
      </div>
    </div>
  );
}
