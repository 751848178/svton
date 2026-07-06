/**
 * 服务器详情视图
 *
 * 单一职责：渲染基本信息（可编辑）、已安装服务、关联代理配置、操作面板。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import type { Server } from '../types';

interface ServerDetailViewProps {
  server: Server;
  editing: boolean;
  editForm: { name: string; tags: string };
  detecting: boolean;
  onEditFormChange: (patch: Partial<{ name: string; tags: string }>) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDetect: () => void;
}

export function ServerDetailView({
  server,
  editing,
  editForm,
  detecting,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDetect,
}: ServerDetailViewProps) {
  const t = useTranslations('servers');
  const tc = useTranslations('common');
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
                <span className="mb-1 block font-medium">{t('tagsCommaSeparated')}</span>
                <input
                  value={editForm.tags}
                  onChange={(e) => onEditFormChange({ tags: e.target.value })}
                  className="w-full rounded-md border px-3 py-2"
                />
              </label>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label={t('host')}>
                <dd className="font-mono">{server.host}</dd>
              </Field>
              <Field label={t('port')}>
                <dd>{server.port}</dd>
              </Field>
              <Field label={t('username')}>
                <dd>{server.username}</dd>
              </Field>
              <Field label={t('authType')}>
                <dd>{server.authType === 'password' ? t('passwordAuth') : t('keyAuth')}</dd>
              </Field>
              <div className="col-span-2">
                <dt className="text-muted-foreground">{t('tags')}</dt>
                <dd className="mt-1 flex gap-1">
                  {server.tags && server.tags.length > 0 ? (
                    server.tags.map((tag, i) => (
                      <Tag
                        key={i}
                        color="default"
                      >
                        {tag}
                      </Tag>
                    ))
                  ) : (
                    <span className="text-muted-foreground">{t('none')}</span>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <ServicesGrid
          server={server}
          detecting={detecting}
          onDetect={onDetect}
        />

        {server.proxyConfigs && server.proxyConfigs.length > 0 ? (
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 font-semibold">{t('associatedProxyConfigs')}</h2>
            <div className="space-y-2">
              {server.proxyConfigs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 p-3"
                >
                  <div>
                    <div className="font-medium">{config.name}</div>
                    <div className="text-sm text-muted-foreground">{config.domain}</div>
                  </div>
                  <Tag color={config.status === 'active' ? 'green' : 'orange'}>{config.status}</Tag>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ServicesGrid({
  server,
  detecting,
  onDetect,
}: {
  server: Server;
  detecting: boolean;
  onDetect: () => void;
}) {
  const t = useTranslations('servers');
  const entries = Object.entries(server.services || {});
  return (
    <div className="rounded-lg border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{t('installedServices')}</h2>
        <button
          onClick={onDetect}
          disabled={detecting}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          {detecting ? t('detecting') : t('redetect')}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {entries.map(([name, installed]) => (
          <div
            key={name}
            className={`rounded-md px-3 py-2 text-sm ${installed ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}
          >
            {name}
            {installed ? <span className="ml-1">✓</span> : null}
          </div>
        ))}
        {entries.length === 0 ? (
          <p className="col-span-3 text-sm text-muted-foreground">
            {t('detectHint')}
          </p>
        ) : null}
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
