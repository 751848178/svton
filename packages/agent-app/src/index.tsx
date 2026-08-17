/**
 * @svton/agent-app
 *
 * Out-of-the-box AI agent application.
 * One component, full chat capability, zero configuration.
 *
 * ```tsx
 * import { AgentApp } from '@svton/agent-app';
 *
 * function App() {
 *   return (
 *     <AgentApp
 *       providers={[{
 *         type: 'openai',
 *         apiKey: process.env.OPENAI_API_KEY!,
 *         models: [{ id: 'gpt-4o', name: 'GPT-4o' }]
 *       }]}
 *     />
 *   );
 * }
 * ```
 */

export { AgentApp } from './AgentApp';
export { AgentShell } from './components/AgentShell';
export { DefaultSettingsAdapter } from './lib/default-settings-adapter';
export { useSessionSettingsControl } from './models/use-session-settings-control';
export { createAgentAppPermissionProfileHost } from './models/agent-app-permission-profile-host';
export { createAgentConfig } from './lib/create-agent-config';
export { createTimelineHostIntentHandler } from './components/timeline-host-intents';
export { useChatInteractionController } from './chat/use-chat-interaction-controller';
export { prepareChatInput, formatRuntimeComposerSubmission } from './chat/composer-submission';
export { useArtifactController } from './artifacts/use-artifact-controller';
export { buildArtifactExportRequest } from './artifacts/artifact-export.utils';
export { LiveModelRegistry } from './models/model-registry';
export { useModelRegistry } from './models/use-model-registry';
export { useModelSwitch } from './models/use-model-switch';
export { useAgentShellModelControl } from './components/use-agent-shell-model-control';
export type {
  ModelRegistryRecord,
  ModelRegistrySnapshot,
  RegistryModelSource,
  RegistryProviderSource,
} from './models/model-registry';
export type { TimelineHostActions } from './components/timeline-host-intents';
export {
  projectClientMessageToChatPanel,
  toInlineChatBlocks,
} from './components/agent-shell-message-boundary.utils';

export type {
  AgentAppProps,
  ProviderConfig,
  ModelConfig,
  FeatureFlags,
  ImageProviderConfig,
  SettingsPersistenceConfig,
  StorageConfig,
  IntegrationConfig,
  MarketplaceConfig,
  RuntimeConfig,
  McpServerEntry,
  View,
  ModelOption,
} from './types';
