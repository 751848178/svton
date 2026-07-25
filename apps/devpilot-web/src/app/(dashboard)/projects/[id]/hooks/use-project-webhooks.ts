/**
 * 项目 Webhook 写操作 Hook
 *
 * 单一职责：封装 webhook 的 create / update / rotate-secret / deliveries 四端点。
 * 与 use-project-detail 的只读 loadWebhooks 解耦：本 hook 只负责变更，
 * 成功后由调用方回调 onMutated 触发列表重载。
 */

'use client';

import { useCallback, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ProjectWebhook, WebhookDelivery } from '../types/operations';

export interface CreateWebhookInput {
  projectId: string;
  name?: string;
  provider?: 'github' | 'gitlab' | 'gitee' | 'generic';
  environmentId?: string;
  eventTypes?: string[];
  branchPattern?: string;
  deploymentMode?: 'dry_run' | 'queue' | 'live_request' | 'preview';
  maxAttempts?: number;
}

export interface UpdateWebhookInput {
  name?: string;
  enabled?: boolean;
  eventTypes?: string[];
  branchPattern?: string;
  deploymentMode?: 'dry_run' | 'queue' | 'live_request' | 'preview';
  maxAttempts?: number;
}

export interface WebhookMutateResult extends ProjectWebhook {
  /** 创建/轮换后一次性返回的明文 setupSecret，仅此一次可见。 */
  setupSecret?: string;
}

export function useProjectWebhooks(onMutated?: () => void) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [rotating, setRotating] = useState(false);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const createWebhook = useCallback(
    async (input: CreateWebhookInput): Promise<WebhookMutateResult | null> => {
      setCreating(true);
      setCreateError('');
      try {
        const created = await apiRequest<WebhookMutateResult>('POST:/project-webhooks', input);
        await onMutated?.();
        return created;
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setCreating(false);
      }
    },
    [onMutated],
  );

  const updateWebhook = useCallback(
    async (id: string, input: UpdateWebhookInput): Promise<boolean> => {
      setUpdating(true);
      setUpdateError('');
      try {
        await apiRequest(`PATCH:/project-webhooks/${id}`, input);
        await onMutated?.();
        return true;
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setUpdating(false);
      }
    },
    [onMutated],
  );

  /** 轮换密钥：返回新 setupSecret(仅此一次可见),失败返回 null。 */
  const rotateSecret = useCallback(
    async (id: string): Promise<string | null> => {
      setRotating(true);
      try {
        const result = await apiRequest<WebhookMutateResult>(
          `POST:/project-webhooks/${id}/rotate-secret`,
        );
        await onMutated?.();
        return result.setupSecret ?? null;
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setRotating(false);
      }
    },
    [onMutated],
  );

  const loadDeliveries = useCallback(async (webhookId: string): Promise<WebhookDelivery[]> => {
    setLoadingDeliveries(true);
    try {
      return await apiRequest<WebhookDelivery[]>('GET:/project-webhooks/deliveries', { webhookId });
    } catch {
      return [];
    } finally {
      setLoadingDeliveries(false);
    }
  }, []);

  return {
    creating,
    createError,
    updating,
    updateError,
    rotating,
    loadingDeliveries,
    createWebhook,
    updateWebhook,
    rotateSecret,
    loadDeliveries,
    clearCreateError: () => setCreateError(''),
    clearUpdateError: () => setUpdateError(''),
  };
}
