/**
 * 环境服务器绑定区块
 *
 * 单一职责:列出已绑定服务器(每行可解绑)、提供「绑定服务器」入口、
 *   解绑走 ConfirmDialog(danger)、绑定走 BindServerModal。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ConfirmDialog } from '@/components/ui';
import { useEnvironmentActions } from '../hooks/use-environment-actions';
import { BindServerModal } from './environment-bind-server-modal';
import type { ProjectEnvironment } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function BindServerBlock({
  environment,
  actions,
  t,
}: {
  environment: ProjectEnvironment;
  actions: ReturnType<typeof useEnvironmentActions>;
  t: ProjectsTranslator;
}) {
  const [bindOpen, setBindOpen] = useState(false);
  const [unbindTarget, setUnbindTarget] = useState<{
    bindingId: string;
    serverId: string;
    name: string;
  } | null>(null);
  const bindings = environment.serverBindings ?? [];

  return (
    <div className="space-y-2">
      {bindings.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {bindings.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">
                <span className="font-medium">{b.server.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {b.server.host}
                </span>
              </span>
              <button
                onClick={() =>
                  setUnbindTarget({ bindingId: b.id, serverId: b.server.id, name: b.server.name })
                }
                className="shrink-0 text-xs text-red-600 hover:text-red-700"
              >
                {t('envUnbindServer')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setBindOpen(true)}
        disabled={actions.acting}
      >
        + {t('envBindServer')}
      </Button>

      <BindServerModal
        open={bindOpen}
        onClose={() => setBindOpen(false)}
        excludeIds={bindings.map((b) => b.server.id)}
        onConfirm={async (serverId, role) => {
          const ok = await actions.bindServer(serverId, role);
          if (ok) setBindOpen(false);
        }}
      />

      <ConfirmDialog
        open={Boolean(unbindTarget)}
        onOpenChange={(open) => {
          if (!open) setUnbindTarget(null);
        }}
        tone="danger"
        title={t('envUnbindServerTitle')}
        description={t('envUnbindServerConfirm', { name: unbindTarget?.name ?? '' })}
        confirmLabel={t('envUnbindServer')}
        onConfirm={async () => {
          if (!unbindTarget) return;
          const ok = await actions.unbindServer(unbindTarget.bindingId, unbindTarget.serverId);
          if (ok) setUnbindTarget(null);
        }}
      />
    </div>
  );
}
