/**
 * 部署 Tab
 *
 * 单一职责：全宽渲染既有 DeploymentPanel（部署运行历史，含"查看全部"展开）。
 * 把概览里只展示一条的英雄卡与完整历史分离 —— 概览看最新一条，
 * 这里看全部历史。
 *
 * 复用 DeploymentPanel，不重复实现列表/展开逻辑。
 */

'use client';

import type { useProjectDetail } from '../../hooks/use-project-detail';
import { DeploymentPanel } from '../deployment-panel';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function DeploymentsTab({ detail }: { detail: DetailHook }) {
  return <DeploymentPanel detail={detail} />;
}
