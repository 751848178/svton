export type DeliveryAction =
  | 'open_environments'
  | 'request_resource'
  | 'open_resources'
  | 'open_applications'
  | 'deploy'
  | 'open_deployments';

export function getProjectDeliveryNextAction(input: {
  environmentCount: number;
  serviceCount: number;
  unboundResourceCount: number;
  hasDeployments: boolean;
  resourceOnly: boolean;
}) {
  if (input.environmentCount === 0) {
    return next(
      'open_environments',
      'deliveryActionEnvironment',
      'deliveryNextEnvironment',
      'deliveryNextEnvironmentDesc',
    );
  }
  if (input.unboundResourceCount > 0) {
    return next(
      'open_resources',
      'deliveryActionBindResource',
      'deliveryNextBindResource',
      'deliveryNextBindResourceDesc',
    );
  }
  if (input.resourceOnly) {
    return next(
      'request_resource',
      'deliveryActionRequestResource',
      'deliveryNextRequestResource',
      'deliveryNextRequestResourceDesc',
    );
  }
  if (input.serviceCount === 0) {
    return next(
      'open_applications',
      'deliveryActionService',
      'deliveryNextService',
      'deliveryNextServiceDesc',
    );
  }
  if (!input.hasDeployments) {
    return next('deploy', 'deliveryActionPlan', 'deliveryNextPlan', 'deliveryNextPlanDesc');
  }
  return next(
    'open_deployments',
    'deliveryActionEvidence',
    'deliveryNextEvidence',
    'deliveryNextEvidenceDesc',
  );
}

function next(action: DeliveryAction, labelKey: string, titleKey: string, detailKey: string) {
  return { action, labelKey, titleKey, detailKey };
}
