/**
 * 环境 Tab
 *
 * 单一职责：渲染既有 EnvironmentPanel（已包含 _count 资源摘要）。
 * 环境的站点/托管资源/部署次数 rollup 已在面板内展示，这里仅做布局。
 */

'use client';

import type { useProjectDetail } from '../../hooks/use-project-detail';
import { EnvironmentPanel } from '../environment-panel';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvironmentsTab({ detail }: { detail: DetailHook }) {
  return (
    <div className="mx-auto max-w-4xl">
      <EnvironmentPanel detail={detail} />
    </div>
  );
}
