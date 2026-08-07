/**
 * 跨环境复用（AC-SET-036）Hook
 *
 * 单一职责：把普通变量 + Secret 引用复制到所选目标环境——每个目标环境通过
 * POST /project-environments/:id/config-revisions/copy 走一次独立修订写入
 * （服务端 per-env CAS + 同事务审计），返回逐环境结果。
 */

'use client';

import { useCallback, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

export interface EnvCopyTarget {
  environmentId: string;
  expectedCurrentRevisionId?: string;
}

export interface EnvCopyOutcome {
  environmentId: string;
  key: string;
  ok: boolean;
  revision?: { id: string; revision: number; snapshotHash: string };
  error?: string;
}

export interface EnvCopyResult {
  sourceEnvironmentId: string;
  results: EnvCopyOutcome[];
}

export function useEnvironmentEnvCopy(sourceEnvironmentId: string) {
  const [copying, setCopying] = useState(false);

  const copy = useCallback(
    async (payload: {
      targets: EnvCopyTarget[];
      plainVariables: Record<string, string>;
      secretReferenceIds: string[];
      changeSummary?: string;
    }) => {
      setCopying(true);
      try {
        return await apiRequest<EnvCopyResult>(
          `POST:/project-environments/${sourceEnvironmentId}/config-revisions/copy`,
          payload,
        );
      } catch (cause) {
        throw cause;
      } finally {
        setCopying(false);
      }
    },
    [sourceEnvironmentId],
  );

  return { copying, copy };
}
