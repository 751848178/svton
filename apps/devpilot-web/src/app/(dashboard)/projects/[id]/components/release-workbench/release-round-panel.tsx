/**
 * 步骤条右侧纵向信息栏（以纵向分割线与步骤区分隔）：
 * 当前轮次的构建信息与部署信息；生产发布在环境发布链的生产节点视图承载。
 */
'use client';

import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { ReleaseRoundBuildCard } from './release-round-build-card';
import { ReleaseRoundDeployCard } from './release-round-deploy-card';

interface Props {
  latestBuild: ReleaseBuildItem | null;
  latestDeployment: ReleaseStagingDeploymentItem | null;
  builds: ReleaseBuildItem[];
  building: boolean;
  buildFrozen: boolean;
  buildGate: { allowed: boolean; reason: string };
  /** PX-4：当前查看的步骤；对应步骤详情展开时右栏压缩重复字段。 */
  selectedStep?: 'preflight' | 'build' | 'staging';
  onBuildLatest: () => void;
  onOpenBuildHistory: () => void;
  onOpenDeployHistory: () => void;
  onOpenDeployLog: (runId: string) => void;
}

export function ReleaseRoundPanel(props: Props) {
  return (
    <aside
      className="min-w-0 overflow-hidden border-t border-border xl:sticky xl:top-4 xl:border-l xl:border-t-0"
      aria-label="release-round-panel"
    >
      <ReleaseRoundBuildCard
        build={props.latestBuild}
        building={props.building}
        buildFrozen={props.buildFrozen}
        buildGate={props.buildGate}
        compact={props.selectedStep === 'build'}
        onBuildLatest={props.onBuildLatest}
        onOpenHistory={props.onOpenBuildHistory}
      />
      <ReleaseRoundDeployCard
        deployment={props.latestDeployment}
        builds={props.builds}
        compact={props.selectedStep === 'staging'}
        onOpenHistory={props.onOpenDeployHistory}
        onOpenLatestLog={props.onOpenDeployLog}
      />
    </aside>
  );
}
