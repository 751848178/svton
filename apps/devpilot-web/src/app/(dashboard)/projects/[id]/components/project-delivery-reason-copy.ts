const REASON_KEYS: Record<string, string> = {
  repository_intake_incomplete: 'projectDeliveryReasonRepository',
  governed_baselines_incomplete: 'projectDeliveryReasonBaselines',
  legacy_component_identity_unresolved: 'projectDeliveryReasonLegacyIdentity',
  baseline_service_topology_mismatch: 'projectDeliveryReasonServices',
  required_variables_unresolved: 'projectDeliveryReasonVariables',
  required_plain_variables_unresolved: 'projectDeliveryReasonVariables',
  required_secret_variables_unresolved: 'projectDeliveryReasonVariables',
  config_revision_missing: 'projectDeliveryReasonConfig',
  config_revision_scope_invalid: 'projectDeliveryReasonConfigScope',
  config_revision_invalid: 'projectDeliveryReasonConfigInvalid',
  config_revision_hash_invalid: 'projectDeliveryReasonConfigHash',
  secret_reference_invalid: 'projectDeliveryReasonSecret',
  resource_reference_invalid: 'projectDeliveryReasonResource',
  policy_reference_invalid: 'projectDeliveryReasonPolicy',
  TARGET_MISSING: 'projectDeliveryReasonTargetMissing',
  TARGET_DUPLICATED: 'projectDeliveryReasonTargetDuplicate',
  PROVIDER_MISMATCH: 'projectDeliveryReasonProviderMismatch',
  SSH_ROOT_INVALID: 'projectDeliveryReasonSshRoot',
  SSH_CONNECTION_INVALID: 'projectDeliveryReasonSshConnection',
  governed_route_missing: 'projectDeliveryReasonRoute',
  governed_route_service_missing: 'projectDeliveryReasonRoute',
  route_service_id_invalid: 'projectDeliveryReasonRouteService',
  route_service_scope_invalid: 'projectDeliveryReasonRouteService',
  route_service_port_invalid: 'projectDeliveryReasonRoutePort',
  route_service_name_mismatch: 'projectDeliveryReasonRouteName',
  release_action_required: 'projectDeliveryReasonRelease',
};

export function projectDeliveryReasonKey(reason: string | undefined) {
  return reason ? REASON_KEYS[reason] : undefined;
}
