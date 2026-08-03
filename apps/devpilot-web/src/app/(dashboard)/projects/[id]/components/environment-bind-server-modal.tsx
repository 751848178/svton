/**
 * 绑定服务器到环境 - 弹窗
 *
 * 单一职责:打开时懒加载 GET:/servers(排除已绑定),提供服务器 + 角色选择,
 * 确定后回调 onConfirm(serverId, role)。
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Modal, Select } from '@/components/ui';
import { apiRequest } from '@/lib/api-client';
import type { EnvironmentServerRole } from '../hooks/use-environment-actions';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export interface ServerOption {
  id: string;
  name: string;
  host: string;
}

const ROLE_OPTIONS: Array<{ value: EnvironmentServerRole; labelKey: string }> = [
  { value: 'deploy', labelKey: 'envServerRoleDeploy' },
  { value: 'runtime', labelKey: 'envServerRoleRuntime' },
  { value: 'database', labelKey: 'envServerRoleDatabase' },
  { value: 'edge', labelKey: 'envServerRoleEdge' },
  { value: 'mixed', labelKey: 'envServerRoleMixed' },
];

export function BindServerModal({
  open,
  onClose,
  excludeIds,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  excludeIds: string[];
  onConfirm: (serverId: string, role?: EnvironmentServerRole) => Promise<void>;
}) {
  const t = useTranslations('projects');
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [serverId, setServerId] = useState('');
  const [role, setRole] = useState<EnvironmentServerRole>('deploy');
  const [loading, setLoading] = useState(false);
  const excludeKey = excludeIds.join(',');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const excluded = new Set(excludeKey.split(',').filter(Boolean));
    apiRequest<ServerOption[]>('GET:/servers')
      .then((list) => {
        if (!cancelled) {
          setServers(list.filter((s) => !excluded.has(s.id)));
          setServerId('');
        }
      })
      .catch(() => {
        if (!cancelled) setServers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, excludeKey]);

  const submit = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      await onConfirm(serverId, role);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('envBindServerTitle')}
      width={420}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {t('envCancel')}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={loading}
            disabled={!serverId}
          >
            {t('envBindServer')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envServerLabel')}</span>
          <Select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            placeholder={t('envSelectServer')}
            options={servers.map((s) => ({ value: s.id, label: `${s.name} (${s.host})` }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envServerRoleLabel')}</span>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as EnvironmentServerRole)}
            options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: t(r.labelKey) }))}
          />
        </label>
      </div>
    </Modal>
  );
}
