/**
 * 监控操作 Hook
 *
 * 单一职责：告警规则创建、静默管理、通知通道管理、事件确认、规则评估。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type {
  AlertRule,
  AlertEvent,
  AlertSilence,
  AlertNotificationChannel,
  AlertNotificationDelivery,
} from '../types';

interface UseMonitoringActionsArgs {
  rules: AlertRule[];
  setRules: React.Dispatch<React.SetStateAction<AlertRule[]>>;
  events: AlertEvent[];
  setEvents: React.Dispatch<React.SetStateAction<AlertEvent[]>>;
  silences: AlertSilence[];
  setSilences: React.Dispatch<React.SetStateAction<AlertSilence[]>>;
  notificationChannels: AlertNotificationChannel[];
  setNotificationChannels: React.Dispatch<React.SetStateAction<AlertNotificationChannel[]>>;
  notificationDeliveries: AlertNotificationDelivery[];
  setNotificationDeliveries: React.Dispatch<React.SetStateAction<AlertNotificationDelivery[]>>;
  setError: (e: string) => void;
  setActingId: (id: string) => void;
  setCreatingRule: (v: boolean) => void;
  setCreatingSilence: (v: boolean) => void;
  setCreatingChannel: (v: boolean) => void;
  loadData: () => Promise<void>;
}

export function useMonitoringActions(args: UseMonitoringActionsArgs) {
  const {
    setRules,
    setEvents,
    setSilences,
    setNotificationChannels,
    setNotificationDeliveries,
    setError,
    setActingId,
    setCreatingRule,
    setCreatingSilence,
    setCreatingChannel,
    loadData,
  } = args;

  const evaluateRule = usePersistFn(async (rule: AlertRule) => {
    setActingId(`rule:${rule.id}:evaluate`);
    setError('');
    try {
      await apiRequest(`POST:/monitoring/alert-rules/${rule.id}/evaluate`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '评估规则失败');
    } finally {
      setActingId('');
    }
  });

  const acknowledgeEvent = usePersistFn(async (event: AlertEvent) => {
    setActingId(`event:${event.id}:ack`);
    setError('');
    try {
      await apiRequest(`POST:/monitoring/alert-events/${event.id}/acknowledge`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认事件失败');
    } finally {
      setActingId('');
    }
  });

  const updateSilenceStatus = usePersistFn(async (silence: AlertSilence, status: string) => {
    setActingId(`silence:${silence.id}`);
    setError('');
    try {
      await apiRequest(`PUT:/monitoring/silences/${silence.id}`, { status });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新静默状态失败');
    } finally {
      setActingId('');
    }
  });

  const updateNotificationChannelStatus = usePersistFn(
    async (channel: AlertNotificationChannel, status: string) => {
      setActingId(`channel:${channel.id}`);
      setError('');
      try {
        await apiRequest(`PUT:/monitoring/notification-channels/${channel.id}`, { status });
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : '更新通道状态失败');
      } finally {
        setActingId('');
      }
    },
  );

  const retryNotificationDelivery = usePersistFn(async (delivery: AlertNotificationDelivery) => {
    setActingId(`delivery:${delivery.id}`);
    setError('');
    try {
      await apiRequest(`POST:/monitoring/notification-deliveries/${delivery.id}/retry`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试投递失败');
    } finally {
      setActingId('');
    }
  });

  // 返回是否成功，供弹窗决定关闭 + 成功反馈；失败时错误写入 error 由弹窗就地展示
  const createRule = usePersistFn(async (body: Record<string, unknown>): Promise<boolean> => {
    setCreatingRule(true);
    setError('');
    try {
      await apiRequest('POST:/monitoring/alert-rules', body);
      await loadData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建规则失败');
      return false;
    } finally {
      setCreatingRule(false);
    }
  });

  const createSilence = usePersistFn(async (body: Record<string, unknown>): Promise<boolean> => {
    setCreatingSilence(true);
    setError('');
    try {
      await apiRequest('POST:/monitoring/silences', body);
      await loadData();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建静默失败');
      return false;
    } finally {
      setCreatingSilence(false);
    }
  });

  const createNotificationChannel = usePersistFn(
    async (body: Record<string, unknown>): Promise<boolean> => {
      setCreatingChannel(true);
      setError('');
      try {
        await apiRequest('POST:/monitoring/notification-channels', body);
        await loadData();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建通道失败');
        return false;
      } finally {
        setCreatingChannel(false);
      }
    },
  );

  return {
    evaluateRule,
    acknowledgeEvent,
    updateSilenceStatus,
    updateNotificationChannelStatus,
    retryNotificationDelivery,
    createRule,
    createSilence,
    createNotificationChannel,
  };
}
