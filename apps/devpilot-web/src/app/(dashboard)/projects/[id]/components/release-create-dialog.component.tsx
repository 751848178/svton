'use client';

import { Modal } from '@/components/ui';
import { ReleaseCreateWizard } from './release-create-wizard.component';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { useProjectReleaseOperations } from '../hooks/use-project-release-operations';

type DetailHook = ReturnType<typeof useProjectDetail>;
type Ops = ReturnType<typeof useProjectReleaseOperations>;

export interface ReleaseCreateDialogProps {
  open: boolean;
  detail: DetailHook;
  ops: Ops;
  onCancel: () => void;
  onCreated: (planId: string) => void;
}

export function ReleaseCreateDialog({
  open,
  detail,
  ops,
  onCancel,
  onCreated,
}: ReleaseCreateDialogProps): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="新建发布"
      width={720}
    >
      <ReleaseCreateWizard
        detail={detail}
        ops={ops}
        onCancel={onCancel}
        onCreated={onCreated}
      />
    </Modal>
  );
}
