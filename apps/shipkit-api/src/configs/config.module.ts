import { SecretStore } from '../secrets/secret-store.js';
import { ConfigController } from './config.controller.js';
import { ConfigPrivateService } from './config-private.service.js';
import { ConfigRepository } from './config.repository.js';
import { ConfigService } from './config.service.js';

// Root module composes these arrays with its single shared database and policy.
export const configControllers = [ConfigController];
export const configProviders = [SecretStore, ConfigRepository, ConfigPrivateService, ConfigService];
export { SecretStore, ConfigService };
export type { SecretScope } from '../secrets/secret-scope.js';
export type { PublicVersion, ResolvedConfig, ConfigRef } from './config.types.js';
