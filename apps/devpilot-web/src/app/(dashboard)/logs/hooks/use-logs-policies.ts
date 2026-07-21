/**
 * 日志策略保存 Hook
 *
 * 单一职责：脱敏策略、SLS 回填策略、Server follow 策略的保存。
 */

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type { LogsState } from './use-logs-state';
import type { LogsTailState } from './use-logs-tail-state';
import type { LogStream } from '../types-stream';
import {
  mergeRedactionMetadata,
  mergeSlsBackfillMetadata,
  mergeServerFollowMetadata,
  parseRedactionKeys,
} from '../utils-metadata';

interface UseLogsPoliciesArgs {
  s: LogsState;
  t: LogsTailState;
  selectedStream: LogStream | null;
  loadData: () => Promise<void>;
}

export function useLogsPolicies(args: UseLogsPoliciesArgs) {
  const { s, t, selectedStream, loadData } = args;
  const tl = useTranslations('logs');

  const saveRedactionPolicy = usePersistFn(async () => {
    if (!selectedStream) {
      feedback.error(tl('selectStream'));
      return;
    }
    t.setSavingRedaction(true);
    s.setError('');
    try {
      await apiRequest(`PUT:/logs/streams/${selectedStream.id}`, {
        metadata: mergeRedactionMetadata(selectedStream.metadata, {
          extraKeys: parseRedactionKeys(t.redactionExtraKeys),
          maskEmails: t.redactionMaskEmails,
          maskIpAddresses: t.redactionMaskIpAddresses,
        }),
      });
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : tl('saveRedactionFailed'));
    } finally {
      t.setSavingRedaction(false);
    }
  });

  const saveSlsBackfillPolicy = usePersistFn(async () => {
    if (!selectedStream) {
      feedback.error(tl('selectStream'));
      return;
    }
    t.setSavingSlsBackfill(true);
    s.setError('');
    try {
      await apiRequest(`PUT:/logs/streams/${selectedStream.id}`, {
        metadata: mergeSlsBackfillMetadata(selectedStream.metadata, {
          enabled: t.slsBackfillEnabled,
          live: t.slsBackfillLive,
          confirmLiveRead: t.slsBackfillLive && t.slsBackfillConfirmLiveRead,
          query: t.slsBackfillQuery.trim() || '*',
          windowMinutes: t.slsBackfillWindowMinutes,
          limit: t.slsBackfillLimit,
          intervalMinutes: t.slsBackfillIntervalMinutes,
        }),
      });
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : tl('saveSlsBackfillFailed'));
    } finally {
      t.setSavingSlsBackfill(false);
    }
  });

  const saveServerFollowPolicy = usePersistFn(async () => {
    if (!selectedStream) {
      feedback.error(tl('selectStream'));
      return;
    }
    t.setSavingServerFollow(true);
    s.setError('');
    try {
      await apiRequest(`PUT:/logs/streams/${selectedStream.id}`, {
        metadata: mergeServerFollowMetadata(selectedStream.metadata, {
          enabled: t.serverFollowEnabled,
          live: t.serverFollowLive,
          confirmLiveRead: t.serverFollowLive && t.serverFollowConfirmLiveRead,
          queue: t.serverFollowQueue,
          tail: t.serverFollowTail,
          intervalMinutes: t.serverFollowIntervalMinutes,
          maxAttempts: t.serverFollowMaxAttempts,
        }),
      });
      await loadData();
    } catch (err) {
      s.setError(err instanceof Error ? err.message : tl('saveServerFollowFailed'));
    } finally {
      t.setSavingServerFollow(false);
    }
  });

  return { saveRedactionPolicy, saveSlsBackfillPolicy, saveServerFollowPolicy };
}
