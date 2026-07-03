/**
 * 日志 Tail 元数据表单副作用
 *
 * 单一职责：按当前日志流同步元数据表单，并在切换日志流时重置 Tail 状态。
 */

import { useEffect } from 'react';
import { usePersistFn } from '@svton/hooks';
import type { LogsState } from './use-logs-state';
import type { LogsTailState } from './use-logs-tail-state';
import type { LogStream } from '../types-stream';
import {
  readRedactionMetadata,
  readSlsBackfillMetadata,
  readServerFollowMetadata,
} from '../utils-metadata';

interface UseLogsTailMetadataEffectsArgs {
  selectedStream: LogStream | null;
  selectedStreamId: string;
  t: LogsTailState;
  tailCursorRef: LogsState['tailCursorRef'];
}

export function useLogsTailMetadataEffects(args: UseLogsTailMetadataEffectsArgs) {
  const { selectedStream, selectedStreamId, t, tailCursorRef } = args;
  const {
    setRedactionExtraKeys,
    setRedactionMaskEmails,
    setRedactionMaskIpAddresses,
    setServerFollowConfirmLiveRead,
    setServerFollowEnabled,
    setServerFollowIntervalMinutes,
    setServerFollowLive,
    setServerFollowMaxAttempts,
    setServerFollowQueue,
    setServerFollowTail,
    setSlsBackfillConfirmLiveRead,
    setSlsBackfillEnabled,
    setSlsBackfillIntervalMinutes,
    setSlsBackfillLimit,
    setSlsBackfillLive,
    setSlsBackfillQuery,
    setSlsBackfillWindowMinutes,
    setSlsConfirmLiveRead,
    setSlsLiveCollect,
    setTailCursor,
    setTailEntries,
    setTailError,
    setTailStreamConnecting,
    setTailStreamExpiresAt,
    setTailStreamLastEventAt,
    setTailStreamNextRetryAt,
    setTailStreamReconnects,
    setTailStreamSessionId,
    setTailStreaming,
  } = t;

  const hydrateStreamMetadata = usePersistFn((streamMetadata?: LogStream['metadata']) => {
    const redaction = readRedactionMetadata(streamMetadata);
    setRedactionExtraKeys((redaction.extraKeys || []).join(', '));
    setRedactionMaskEmails(redaction.maskEmails);
    setRedactionMaskIpAddresses(redaction.maskIpAddresses);
    const sls = readSlsBackfillMetadata(streamMetadata);
    setSlsBackfillEnabled(sls.enabled);
    setSlsBackfillLive(sls.live);
    setSlsBackfillConfirmLiveRead(sls.confirmLiveRead);
    setSlsBackfillQuery(sls.query);
    setSlsBackfillWindowMinutes(sls.windowMinutes);
    setSlsBackfillLimit(sls.limit);
    setSlsBackfillIntervalMinutes(sls.intervalMinutes);
    const follow = readServerFollowMetadata(streamMetadata);
    setServerFollowEnabled(follow.enabled);
    setServerFollowLive(follow.live);
    setServerFollowConfirmLiveRead(follow.confirmLiveRead);
    setServerFollowQueue(follow.queue);
    setServerFollowTail(follow.tail);
    setServerFollowIntervalMinutes(follow.intervalMinutes);
    setServerFollowMaxAttempts(follow.maxAttempts);
  });

  const resetTailState = usePersistFn(() => {
    setTailEntries([]);
    setTailCursor(null);
    tailCursorRef.current = null;
    setTailError('');
    setTailStreaming(false);
    setTailStreamConnecting(false);
    setTailStreamLastEventAt(null);
    setTailStreamReconnects(0);
    setTailStreamNextRetryAt(null);
    setTailStreamSessionId(null);
    setTailStreamExpiresAt(null);
    setSlsLiveCollect(false);
    setSlsConfirmLiveRead(false);
  });

  useEffect(() => {
    hydrateStreamMetadata(selectedStream?.metadata);
  }, [hydrateStreamMetadata, selectedStream?.id, selectedStream?.metadata]);

  useEffect(() => {
    resetTailState();
  }, [resetTailState, selectedStreamId]);
}
