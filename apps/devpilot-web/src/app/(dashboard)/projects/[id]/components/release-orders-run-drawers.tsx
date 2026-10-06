/**
 * 发布单列表的运行抽屉宿主（单一职责：为列表行「查看构建 / 查看部署 /
 * 技术证据」挂载对应运行的数据控制器并渲染日志抽屉）。
 * 抽屉在列表页原地弹出，不打断列表上下文；深链场景仍走详情页参数聚焦。
 */
'use client';

import React from 'react';
import { useReleaseBuilds } from '../hooks/use-release-builds';
import { useReleaseStagingDeployments } from '../hooks/use-release-staging-deployments';
import { ReleaseBuildLogLayer } from './release-workbench/release-build-log-layer';
import { ReleaseStagingLogLayer } from './release-workbench/release-staging-log-layer';

export type ReleaseOrderRunFocus =
  | { type: 'build'; releaseOrderId: string; buildRunId: string }
  | { type: 'deployment'; releaseOrderId: string; deploymentRunId: string };

const noop = () => Promise.resolve();

export function ReleaseOrdersBuildRunDrawer(props: {
  projectId: string;
  focus: Extract<ReleaseOrderRunFocus, { type: 'build' }>;
  onClose: () => void;
}) {
  const builds = useReleaseBuilds(props.projectId, props.focus.releaseOrderId, noop);
  return (
    <ReleaseBuildLogLayer
      projectId={props.projectId}
      releaseOrderId={props.focus.releaseOrderId}
      builds={builds}
      buildRunId={props.focus.buildRunId}
      onClose={props.onClose}
    />
  );
}

export function ReleaseOrdersDeploymentRunDrawer(props: {
  projectId: string;
  focus: Extract<ReleaseOrderRunFocus, { type: 'deployment' }>;
  onClose: () => void;
}) {
  const builds = useReleaseBuilds(props.projectId, props.focus.releaseOrderId, noop);
  const deployments = useReleaseStagingDeployments(props.projectId, props.focus.releaseOrderId);
  return (
    <ReleaseStagingLogLayer
      projectId={props.projectId}
      builds={builds}
      deployments={deployments}
      deploymentRunId={props.focus.deploymentRunId}
      onClose={props.onClose}
    />
  );
}
