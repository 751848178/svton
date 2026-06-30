/**
 * 日志中心 Tail/SSE/策略状态
 *
 * 单一职责：声明 tail 流式、SLS 回填、Server follow、脱敏策略相关状态。
 */

import { useState } from 'react';
import type { LogEntry } from '../types-stream';

export function useLogsTailState() {
  const [slsQuery, setSlsQuery] = useState('*');
  const [slsWindowMinutes, setSlsWindowMinutes] = useState(15);
  const [slsLimit, setSlsLimit] = useState(100);
  const [slsLiveCollect, setSlsLiveCollect] = useState(false);
  const [slsConfirmLiveRead, setSlsConfirmLiveRead] = useState(false);
  const [slsBackfillEnabled, setSlsBackfillEnabled] = useState(false);
  const [slsBackfillLive, setSlsBackfillLive] = useState(false);
  const [slsBackfillConfirmLiveRead, setSlsBackfillConfirmLiveRead] = useState(false);
  const [slsBackfillQuery, setSlsBackfillQuery] = useState('*');
  const [slsBackfillWindowMinutes, setSlsBackfillWindowMinutes] = useState(15);
  const [slsBackfillLimit, setSlsBackfillLimit] = useState(100);
  const [slsBackfillIntervalMinutes, setSlsBackfillIntervalMinutes] = useState(15);
  const [savingSlsBackfill, setSavingSlsBackfill] = useState(false);
  const [serverFollowEnabled, setServerFollowEnabled] = useState(false);
  const [serverFollowLive, setServerFollowLive] = useState(false);
  const [serverFollowConfirmLiveRead, setServerFollowConfirmLiveRead] = useState(false);
  const [serverFollowQueue, setServerFollowQueue] = useState(true);
  const [serverFollowTail, setServerFollowTail] = useState(200);
  const [serverFollowIntervalMinutes, setServerFollowIntervalMinutes] = useState(5);
  const [serverFollowMaxAttempts, setServerFollowMaxAttempts] = useState(3);
  const [savingServerFollow, setSavingServerFollow] = useState(false);
  const [redactionExtraKeys, setRedactionExtraKeys] = useState('');
  const [redactionMaskEmails, setRedactionMaskEmails] = useState(false);
  const [redactionMaskIpAddresses, setRedactionMaskIpAddresses] = useState(false);
  const [savingRedaction, setSavingRedaction] = useState(false);
  const [tailAutoRefresh, setTailAutoRefresh] = useState(false);
  const [tailLoading, setTailLoading] = useState(false);
  const [tailEntries, setTailEntries] = useState<LogEntry[]>([]);
  const [tailCursor, setTailCursor] = useState<string | null>(null);
  const [tailError, setTailError] = useState('');
  const [tailStreaming, setTailStreaming] = useState(false);
  const [tailStreamConnecting, setTailStreamConnecting] = useState(false);
  const [tailStreamLastEventAt, setTailStreamLastEventAt] = useState<string | null>(null);
  const [tailStreamReconnects, setTailStreamReconnects] = useState(0);
  const [tailStreamNextRetryAt, setTailStreamNextRetryAt] = useState<string | null>(null);
  const [tailStreamSessionId, setTailStreamSessionId] = useState<string | null>(null);
  const [tailStreamExpiresAt, setTailStreamExpiresAt] = useState<string | null>(null);
  const [cleaningRetention, setCleaningRetention] = useState<'dry-run' | 'live' | ''>('');
  const [loadingStreamSessions, setLoadingStreamSessions] = useState(false);
  const [closingStreamSessionId, setClosingStreamSessionId] = useState<string | null>(null);
  const [queueLogCollections, setQueueLogCollections] = useState(false);

  return {
    slsQuery,
    setSlsQuery,
    slsWindowMinutes,
    setSlsWindowMinutes,
    slsLimit,
    setSlsLimit,
    slsLiveCollect,
    setSlsLiveCollect,
    slsConfirmLiveRead,
    setSlsConfirmLiveRead,
    slsBackfillEnabled,
    setSlsBackfillEnabled,
    slsBackfillLive,
    setSlsBackfillLive,
    slsBackfillConfirmLiveRead,
    setSlsBackfillConfirmLiveRead,
    slsBackfillQuery,
    setSlsBackfillQuery,
    slsBackfillWindowMinutes,
    setSlsBackfillWindowMinutes,
    slsBackfillLimit,
    setSlsBackfillLimit,
    slsBackfillIntervalMinutes,
    setSlsBackfillIntervalMinutes,
    savingSlsBackfill,
    setSavingSlsBackfill,
    serverFollowEnabled,
    setServerFollowEnabled,
    serverFollowLive,
    setServerFollowLive,
    serverFollowConfirmLiveRead,
    setServerFollowConfirmLiveRead,
    serverFollowQueue,
    setServerFollowQueue,
    serverFollowTail,
    setServerFollowTail,
    serverFollowIntervalMinutes,
    setServerFollowIntervalMinutes,
    serverFollowMaxAttempts,
    setServerFollowMaxAttempts,
    savingServerFollow,
    setSavingServerFollow,
    redactionExtraKeys,
    setRedactionExtraKeys,
    redactionMaskEmails,
    setRedactionMaskEmails,
    redactionMaskIpAddresses,
    setRedactionMaskIpAddresses,
    savingRedaction,
    setSavingRedaction,
    tailAutoRefresh,
    setTailAutoRefresh,
    tailLoading,
    setTailLoading,
    tailEntries,
    setTailEntries,
    tailCursor,
    setTailCursor,
    tailError,
    setTailError,
    tailStreaming,
    setTailStreaming,
    tailStreamConnecting,
    setTailStreamConnecting,
    tailStreamLastEventAt,
    setTailStreamLastEventAt,
    tailStreamReconnects,
    setTailStreamReconnects,
    tailStreamNextRetryAt,
    setTailStreamNextRetryAt,
    tailStreamSessionId,
    setTailStreamSessionId,
    tailStreamExpiresAt,
    setTailStreamExpiresAt,
    cleaningRetention,
    setCleaningRetention,
    loadingStreamSessions,
    setLoadingStreamSessions,
    closingStreamSessionId,
    setClosingStreamSessionId,
    queueLogCollections,
    setQueueLogCollections,
  };
}

export type LogsTailState = ReturnType<typeof useLogsTailState>;
