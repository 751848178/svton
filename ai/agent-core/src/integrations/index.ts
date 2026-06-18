/**
 * Integrations module barrel export.
 */

export type {
  IntegrationCategory,
  AuthType,
  AuthField,
  IntegrationManifest,
  IntegrationConfig,
} from './types';

export { IntegrationManager } from './manager';

// Built-in integrations
export { SlackIntegration } from './builtin/slack';
export { LinearIntegration } from './builtin/linear';
export {
  BUILTIN_INTEGRATIONS,
  resolveBuiltinIntegrationManifests,
  type BuiltinIntegrationId,
} from './builtin';
