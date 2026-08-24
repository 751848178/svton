'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Modal, Select } from '@/components/ui';
import { apiRequest } from '@/lib/api-client';
import type { EnvironmentBindTargetInput } from '../../hooks/use-environment-actions';
import { SettingsEnvTargetFields, type TargetFieldsValue } from './settings-env-target-fields';

interface ServerOption {
  id: string;
  name: string;
  host: string;
}

const EMPTY_TARGET: TargetFieldsValue = {
  providerKey: 'ssh-v1',
  root: '',
  targetRef: '',
  sharedEnvironmentIds: [],
};

export function SettingsEnvTargetCreateDialog(props: {
  open: boolean;
  excludeIds: string[];
  otherEnvironments: Array<{ id: string; key: string; name: string }>;
  onClose: () => void;
  onConfirm: (serverId: string, input: EnvironmentBindTargetInput) => Promise<boolean>;
}) {
  const t = useTranslations('projects');
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [serverId, setServerId] = useState('');
  const [target, setTarget] = useState<TargetFieldsValue>(EMPTY_TARGET);
  const [saving, setSaving] = useState(false);
  const excludeKey = props.excludeIds.join(',');

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    const excluded = new Set(excludeKey.split(',').filter(Boolean));
    setServerId('');
    setTarget(EMPTY_TARGET);
    apiRequest<ServerOption[]>('GET:/servers')
      .then((items) => {
        if (!cancelled) setServers(items.filter((item) => !excluded.has(item.id)));
      })
      .catch(() => {
        if (!cancelled) setServers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [excludeKey, props.open]);

  const submit = async () => {
    setSaving(true);
    try {
      const ok = await props.onConfirm(serverId, {
        role: 'deploy',
        providerKey: target.providerKey,
        root: target.root.trim() || undefined,
        targetRef: target.targetRef.trim() || undefined,
        sharedEnvironmentIds: target.sharedEnvironmentIds,
      });
      if (ok) props.onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={t('envTargetCreateTitle')}
      width={460}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={props.onClose}
            disabled={saving}
          >
            {t('envCancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={saving}
            disabled={!serverId || !target.providerKey}
          >
            {t('envTargetCreate')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envTargetServerLabel')}</span>
          <Select
            value={serverId}
            onChange={(event) => setServerId(event.target.value)}
            placeholder={t('envSelectServer')}
            options={servers.map((item) => ({
              value: item.id,
              label: `${item.name} (${item.host})`,
            }))}
          />
        </label>
        <SettingsEnvTargetFields
          value={target}
          otherEnvironments={props.otherEnvironments}
          onChange={setTarget}
        />
      </div>
    </Modal>
  );
}
