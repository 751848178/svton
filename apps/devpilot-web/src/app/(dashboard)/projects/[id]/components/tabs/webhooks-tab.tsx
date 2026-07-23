/**
 * Webhook Tab
 *
 * 单一职责：渲染既有 WebhookPanel（Webhook 通知列表，含投递记录）。
 * 不重复实现脱敏展示 / 投递时间等逻辑。
 */

'use client';

import type { useProjectDetail } from '../../hooks/use-project-detail';
import { WebhookPanel } from '../webhook-panel';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function WebhooksTab({ detail }: { detail: DetailHook }) {
  return (
    <div className="mx-auto max-w-4xl">
      <WebhookPanel detail={detail} />
    </div>
  );
}
