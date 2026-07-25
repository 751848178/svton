/**
 * Webhook 事件名 → 本地化标签 key 映射。
 *
 * 单一职责：把 Webhook 监听事件原始字符串（如 `push`、`pull_request`、
 * `deployment.completed`）映射为 `projects` 命名空间下的本地化 key。
 * 未知事件返回 null，由调用方回退展示原值。
 *
 * 已知事件来源：后端 project-webhook.service（默认 `push`）、
 * provider 事件（`pull_request` / `merge_request`）、
 * 内部 deployment/sync 事件。
 */

import { useTranslations } from 'next-intl';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

/** 已知事件 → i18n key 表。 */
const EVENT_KEY_MAP: Record<string, string> = {
  push: 'webhookEventPush',
  pull_request: 'webhookEventPullRequest',
  merge_request: 'webhookEventMergeRequest',
  'deployment.completed': 'webhookEventDeploymentCompleted',
  'deployment.started': 'webhookEventDeploymentStarted',
  'deployment.failed': 'webhookEventDeploymentFailed',
  'sync.completed': 'webhookEventSyncCompleted',
};

/** 单个事件 → 本地化标签 key；未知返回 null。 */
export function mapWebhookEventLabelKey(eventType: string): string | null {
  return EVENT_KEY_MAP[eventType] ?? null;
}

/**
 * 把事件数组格式化为本地化展示串。
 *
 * 已知事件 → 翻译值；未知事件 → 原值。多事件用 `、` 连接。
 * 空数组返回 '-'（与原 UI 一致）。
 */
export function formatWebhookEvents(events: string[], t: ProjectsTranslator): string {
  if (events.length === 0) return '-';
  return events
    .map((event) => {
      const key = mapWebhookEventLabelKey(event);
      return key ? t(key) : event;
    })
    .join('、');
}
