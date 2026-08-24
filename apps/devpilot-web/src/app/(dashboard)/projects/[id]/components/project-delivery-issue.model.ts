import type { ProjectDeliveryCheckpoint } from '../types/project-delivery-summary.types';

const ACTION_LABEL_KEYS: Record<string, string> = {
  review_repository: 'projectDeliveryActionReviewRepository',
  repair_baselines: 'projectDeliveryActionRepairBaselines',
  configure_services: 'projectDeliveryActionConfigureServices',
  configure_environment: 'projectDeliveryActionConfigureEnvironment',
  bind_target: 'projectDeliveryActionBindTarget',
  configure_routes: 'projectDeliveryActionConfigureRoutes',
};

export function projectDeliveryActionLabelKey(checkpoint: ProjectDeliveryCheckpoint) {
  return checkpoint.action
    ? (ACTION_LABEL_KEYS[checkpoint.action.kind] ?? 'projectDeliveryActionOpenConfiguration')
    : 'projectDeliveryActionOpenConfiguration';
}
