'use client';

import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { ReleaseStepCompletionPanel } from './release-step-completion-panel';
import { ReleaseStepPostValidationPanel } from './release-step-post-validation-panel';
import type { ReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';

interface Props {
  mode: 'validation' | 'complete';
  detail: ReleaseOrderDetail;
  lifecycleEvidence: ReleaseLifecycleEvidence;
}

export function ReleaseLifecycleOutcomePanel(props: Props) {
  return props.mode === 'validation' ? (
    <ReleaseStepPostValidationPanel lifecycleEvidence={props.lifecycleEvidence} />
  ) : (
    <ReleaseStepCompletionPanel
      detail={props.detail}
      lifecycleEvidence={props.lifecycleEvidence}
    />
  );
}
