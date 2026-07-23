'use client';

import { useTranslations } from 'next-intl';
import {
  formatAgentRuntimeState,
  formatAgentSource,
  formatDate,
} from '../utils';
import { mutedShortId } from '../utils-labels';
import { StatusBadge } from './ui-bits';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

/**
 * Agent 能力样本列表（原 fleet section 内嵌的 samples 区块）。
 *
 * - server.status 走 StatusBadge 归一化为语义色调，不再裸字符串。
 * - runtime.agentId 用 mutedShortId 降级为 #短ID。
 * 单独成文件以满足 200 行上限。
 */
type SupervisorAgent = ServerExecutionSupervisorSnapshot['agent'];

export function SupervisorAgentSamples({ agent }: { agent: SupervisorAgent }) {
  const t = useTranslations('executionGovernance');
  if (agent.samples.length === 0) {
    return <div className="mt-4 text-xs text-muted-foreground">{t('noAgentCapability')}</div>;
  }
  return (
    <div className="mt-4 space-y-2 border-t pt-3">
      {agent.samples.slice(0, 5).map((server) => (
        <div key={server.id} className="text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-foreground">{server.name}</span>
            <StatusBadge status={server.status} />
          </div>
          <div className="mt-1 font-mono">{server.host}</div>
          <div className="mt-1">
            {server.agentRef.displayName} · {formatAgentSource(server.agentRef.source)}
          </div>
          {server.runtime ? (
            <div className="mt-1">
              {t('fleetRuntime', { value: formatAgentRuntimeState(server.runtime.state) })}
              {server.runtime.agentId ? ` · ${mutedShortId(server.runtime.agentId)}` : ''}
              {server.runtime.version ? ` · ${server.runtime.version}` : ''}
              {server.runtime.lastSeenAt
                ? ` · ${t('agentSeenAt', { value: formatDate(server.runtime.lastSeenAt) })}`
                : ''}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
