/**
 * 发布 Tab 弹窗编排。
 *
 * 单一职责：挂载新建、跳过和重试弹窗，并把受控状态接回宿主。
 */
'use client';

import { ReleaseCreateDialog } from './release-create-dialog.component';
import { ReleaseRetryDialog } from './release-retry-dialog.component';
import { ReleaseSkipDialog } from './release-skip-dialog.component';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { useProjectReleaseOperations } from '../hooks/use-project-release-operations';
import type { useReleaseActions } from '../hooks/use-release-actions.hooks';

type DetailHook = ReturnType<typeof useProjectDetail>;
type Ops = ReturnType<typeof useProjectReleaseOperations>;
type Actions = ReturnType<typeof useReleaseActions>;

export interface ReleaseTabDialogsProps {
  detail: DetailHook;
  ops: Ops;
  actions: Actions;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onCreated: (planId: string) => void;
}

export function ReleaseTabDialogs({
  detail,
  ops,
  actions,
  createOpen,
  onCreateOpenChange,
  onCreated,
}: ReleaseTabDialogsProps): JSX.Element {
  return (
    <>
      <ReleaseCreateDialog
        open={createOpen}
        detail={detail}
        ops={ops}
        onCancel={() => onCreateOpenChange(false)}
        onCreated={onCreated}
      />
      <ReleaseSkipDialog
        open={!!actions.skipTarget}
        onOpenChange={(open) => !open && actions.setSkipTarget(null)}
        stageName={actions.skipTarget?.stageName ?? ''}
        onConfirm={actions.handleSkipConfirm}
      />
      <ReleaseRetryDialog
        open={!!actions.retryTarget}
        onOpenChange={(open) => !open && actions.setRetryTarget(null)}
        stageName={actions.retryTarget?.stageName ?? ''}
        nextAttemptNo={actions.retryTarget?.nextAttemptNo ?? 1}
        onConfirm={actions.handleRetryConfirm}
      />
    </>
  );
}
