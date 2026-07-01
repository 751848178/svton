/**
 * 应用服务 SLO 摘要 Hook
 *
 * 单一职责：按可见 ApplicationService 拉取单服务 SLO dashboard row。
 */

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ServiceSloDashboard } from '../../monitoring/types-dashboard';
import type { ServiceSloRow } from '../types';

interface UseApplicationServiceSlosResult {
  serviceSloRows: Record<string, ServiceSloRow | null>;
  serviceSloLoading: boolean;
  serviceSloError: string;
}

export function useApplicationServiceSlos(serviceIds: string[]): UseApplicationServiceSlosResult {
  const stableServiceIds = useMemo(() => Array.from(new Set(serviceIds)).sort(), [serviceIds]);
  const serviceIdsKey = stableServiceIds.join('|');
  const [serviceSloRows, setServiceSloRows] = useState<Record<string, ServiceSloRow | null>>({});
  const [serviceSloLoading, setServiceSloLoading] = useState(false);
  const [serviceSloError, setServiceSloError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadServiceSlos() {
      if (stableServiceIds.length === 0) {
        setServiceSloRows({});
        setServiceSloError('');
        setServiceSloLoading(false);
        return;
      }

      setServiceSloLoading(true);
      setServiceSloError('');
      try {
        const entries = await Promise.all(
          stableServiceIds.map(async (applicationServiceId) => {
            const dashboard = await apiRequest<ServiceSloDashboard>(
              'GET:/monitoring/service-slo/dashboard',
              {
                applicationServiceId,
                limit: 5,
                windowMinutes: 1440,
              },
            );
            const row = dashboard.rows[0];
            return [
              applicationServiceId,
              row
                ? {
                    ...row,
                    generatedAt: dashboard.generatedAt,
                    windowMinutes: dashboard.windowMinutes,
                  }
                : null,
            ] as const;
          }),
        );
        if (!cancelled) setServiceSloRows(Object.fromEntries(entries));
      } catch (err) {
        if (!cancelled) {
          setServiceSloRows({});
          setServiceSloError(err instanceof Error ? err.message : '加载服务 SLO 摘要失败');
        }
      } finally {
        if (!cancelled) setServiceSloLoading(false);
      }
    }

    loadServiceSlos();

    return () => {
      cancelled = true;
    };
  }, [serviceIdsKey, stableServiceIds]);

  return { serviceSloRows, serviceSloLoading, serviceSloError };
}
