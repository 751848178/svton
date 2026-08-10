/**
 * 环境配置子区：域名与入口 —— 添加入口弹窗（Demo 对齐）
 *
 * 单一职责：收集一条结构化入口（Host/Path/目标组件与端口/TLS 模式），
 * 写回当前修订草稿的 entries（AC-SET-042/043/046）；保存由修订化保存完成。
 * 弹窗本身不创建 DNS、证书或代理配置。
 */
'use client';

import React, { useState } from 'react';

import { useTranslations } from 'next-intl';
import { Modal } from '@svton/ui';
import type { SettingsRouteTargetOption } from './settings-route-target-options.model';
import type { SettingsRouteEntryDraft } from './settings-env.model';

interface Props {
  open: boolean;
  environmentName: string;
  targetOptions: SettingsRouteTargetOption[];
  onClose: () => void;
  onConfirm: (entry: SettingsRouteEntryDraft) => void;
}

export function SettingsEnvEntryModal({
  open,
  environmentName,
  targetOptions,
  onClose,
  onConfirm,
}: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const [domain, setDomain] = useState('');
  const [path, setPath] = useState('/');
  const [target, setTarget] = useState('custom');
  const [customComponent, setCustomComponent] = useState('');
  const [customPort, setCustomPort] = useState('');
  const [tlsMode, setTlsMode] = useState<'managed_cert' | 'existing_cert_asset'>('managed_cert');

  const reset = () => {
    setDomain('');
    setPath('/');
    setTarget('custom');
    setCustomComponent('');
    setCustomPort('');
    setTlsMode('managed_cert');
  };

  const handleConfirm = () => {
    const trimmed = domain.trim();
    if (!trimmed) return;
    const option = targetOptions.find((candidate) => targetKey(candidate) === target);
    const port = option?.port ?? Number(customPort);
    if (!option && (!customComponent.trim() || !validPort(port))) return;
    onConfirm({
      domain: trimmed,
      path: path.trim() || '/',
      serviceId: option?.serviceId ?? null,
      component: option?.component ?? customComponent.trim(),
      port,
      tlsMode,
    });
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('envRoutesAddEntryTitle', { env: environmentName })}
      width={560}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!domain.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t('envRoutesAddEntryConfirm')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t('envRoutesModalCallout')}
        </p>
        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t('envRoutesHostLabel')}</span>
          <input
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder={t('envRoutesHostPlaceholder')}
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t('envRoutesPathLabel')}</span>
          <input
            className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-sm"
            value={path}
            onChange={(event) => setPath(event.target.value)}
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t('envRoutesTargetLabel')}</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            {targetOptions.map((option) => (
              <option key={targetKey(option)} value={targetKey(option)}>
                {option.component} : {option.port}
              </option>
            ))}
            <option value="custom">
              {t('envRoleCustom')} · {t('envRoutesTableComponent')}
            </option>
          </select>
        </label>
        {target === 'custom' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs">
              <span className="font-medium">{t('envRoutesTableComponent')}</span>
              <input
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={customComponent}
                onChange={(event) => setCustomComponent(event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="font-medium">{t('envRoutesTargetLabel')}</span>
              <input
                type="number"
                min={1}
                max={65_535}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                value={customPort}
                onChange={(event) => setCustomPort(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        <label className="block space-y-1 text-xs">
          <span className="font-medium">{t('envRoutesTlsLabel')}</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={tlsMode}
            onChange={(event) =>
              setTlsMode(event.target.value as 'managed_cert' | 'existing_cert_asset')
            }
          >
            <option value="managed_cert">{t('envRoutesTlsManaged')}</option>
            <option value="existing_cert_asset">{t('envRoutesTlsExisting')}</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}

function targetKey(option: SettingsRouteTargetOption) {
  return `${option.serviceId}:${option.port}`;
}

function validPort(port: number) {
  return Number.isInteger(port) && port > 0 && port <= 65_535;
}
