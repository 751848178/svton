/**
 * Agent follow policy hook.
 *
 * Owns local form state and persistence for LogStream.metadata.agentFollow.
 */

import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { LogStream } from '../types-stream';
import { mergeAgentFollowMetadata, readAgentFollowMetadata } from '../utils-metadata';

type UseAgentFollowPolicyArgs = {
  selectedStream: LogStream | null;
  setError: (message: string) => void;
  loadData: () => Promise<void>;
};

export function useAgentFollowPolicy(args: UseAgentFollowPolicyArgs) {
  const { selectedStream, setError, loadData } = args;
  const [enabled, setEnabled] = useState(false);
  const [live, setLive] = useState(false);
  const [confirmLiveRead, setConfirmLiveRead] = useState(false);
  const [queue, setQueue] = useState(true);
  const [tail, setTail] = useState(200);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const policy = readAgentFollowMetadata(selectedStream?.metadata);
    setEnabled(policy.enabled);
    setLive(policy.live);
    setConfirmLiveRead(policy.confirmLiveRead);
    setQueue(policy.queue);
    setTail(policy.tail);
    setIntervalMinutes(policy.intervalMinutes);
    setMaxAttempts(policy.maxAttempts);
  }, [selectedStream?.id, selectedStream?.metadata]);

  const saveAgentFollowPolicy = usePersistFn(async () => {
    if (!selectedStream) {
      alert('请选择日志流');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiRequest(`PUT:/logs/streams/${selectedStream.id}`, {
        metadata: mergeAgentFollowMetadata(selectedStream.metadata, {
          enabled,
          live,
          confirmLiveRead,
          queue,
          tail,
          intervalMinutes,
          maxAttempts,
        }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 Agent follow 失败');
    } finally {
      setSaving(false);
    }
  });

  return {
    enabled,
    setEnabled,
    live,
    setLive,
    confirmLiveRead,
    setConfirmLiveRead,
    queue,
    setQueue,
    tail,
    setTail,
    intervalMinutes,
    setIntervalMinutes,
    maxAttempts,
    setMaxAttempts,
    saving,
    saveAgentFollowPolicy,
  };
}
