import {
  stagingTechnicalConclusion,
  type ReleaseStagingValidationEvidence,
} from '../../utils/release-staging-view.model';
import type { ProductionConfirmBlocker } from '../../utils/release-production-run.model';

type Translate = (key: string) => string;

export function releaseProductionViewState(
  input: {
    manifestId: string;
    loading: boolean;
    previewAvailable: boolean;
    previewError: string;
    confirmBlocker: ProductionConfirmBlocker;
    stagingProof: ReleaseStagingValidationEvidence | null;
  },
  t: Translate,
) {
  const publishDisabled =
    !input.manifestId || input.loading || !input.previewAvailable || Boolean(input.confirmBlocker);
  const publishDisabledReason =
    input.confirmBlocker === 'preflight'
      ? t('releaseWorkbenchProductionPreflightBlocked')
      : input.confirmBlocker === 'concurrency'
        ? t('productionConfirmConcurrencyOccupied')
        : !input.manifestId
          ? t('releaseWorkbenchPublishDisabledNoManifest')
          : input.loading
            ? t('productionPreviewLoading')
            : !input.previewAvailable
              ? input.previewError || t('productionConfirmNoSnapshot')
              : '';
  const conclusion = input.stagingProof ? stagingTechnicalConclusion(input.stagingProof) : null;
  const stagingProofCopy =
    conclusion?.key === 'releaseStagingVerificationPassed'
      ? t('productionStagingProof')
      : t('productionStagingProofNeutral');
  return { publishDisabled, publishDisabledReason, stagingProofCopy };
}
