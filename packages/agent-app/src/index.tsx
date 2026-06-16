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
export { createAgentConfig } from './lib/create-agent-config';

export type {
  AgentAppProps,
  ProviderConfig,
  ModelConfig,
  FeatureFlags,
  McpServerEntry,
  View,
  ModelOption,
} from './types';
