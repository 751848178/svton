import 'reflect-metadata';
import {
  createAgentConfig,
  type McpServerEntry,
  type ProviderConfig,
} from '@svton/agent-app';
import type { AgentConfig } from '@svton/agent-core';
import type { BrowserPlatform } from '@svton/agent-platform';
import {
  getE2eModelsOverride,
  getE2eReasoningEffort,
  isE2eMemoryDisabled,
  getE2ePostTurnMemoryTimeoutMs,
} from './e2e-provider';
import { registerE2eTimelineTool } from './e2e-timeline-tool';
import { installE2eTimelineSkill } from './e2e-timeline-skill';
import {
  LS_SEARCH_ENDPOINT,
  loadSettings,
  loadString,
} from './settings-store';

const SKILL_PATHS = [
  '/skills/svton/SKILL.md',
  '/skills/svton-api-client/SKILL.md',
  '/skills/svton-service/SKILL.md',
  '/skills/engineering-craft-principles/SKILL.md',
  '/skills/universal-craft-principles/SKILL.md',
  '/skills/verify-before-done/SKILL.md',
  '/skills/plan-before-code/SKILL.md',
  '/skills/codegraph-cli-navigation/SKILL.md',
];

const MCP_SERVERS_KEY = 'agent-web:mcp_servers';

function loadWebMcpServers(): McpServerEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(localStorage.getItem(MCP_SERVERS_KEY) || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((value): McpServerEntry[] => {
    if (!isHttpMcpServer(value)) return [];
    return [{
      name: value.name,
      url: value.url,
      type: 'http',
      enabled: value.enabled,
      approvalMode: value.approvalMode,
      enabledTools: value.enabledTools,
      disabledTools: value.disabledTools,
    }];
  });
}

interface StoredWebMcpServer {
  name: string;
  transport: 'http';
  url: string;
  enabled: true;
  approvalMode?: 'auto' | 'ask' | 'deny';
  enabledTools?: string[];
  disabledTools?: string[];
}

function isOptionalStringList(value: unknown): value is string[] | undefined {
  return value === undefined
    || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

function isHttpMcpServer(value: unknown): value is StoredWebMcpServer {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.enabled === true
    && candidate.transport === 'http'
    && typeof candidate.name === 'string'
    && typeof candidate.url === 'string'
    && candidate.url.length > 0
    && (candidate.approvalMode === undefined
      || candidate.approvalMode === 'auto'
      || candidate.approvalMode === 'ask'
      || candidate.approvalMode === 'deny')
    && isOptionalStringList(candidate.enabledTools)
    && isOptionalStringList(candidate.disabledTools);
}

function loadWebProviders(): ProviderConfig[] {
  return loadSettings().map((provider) => ({
    type: provider.type,
    name: provider.id,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    models: provider.models,
  }));
}

/**
 * Initialize the browser product boundary using AgentApp's shared config
 * assembly and Web-specific persisted settings/E2E injection.
 */
export async function initAgentConfig(
  model?: string,
  platform?: BrowserPlatform,
): Promise<AgentConfig> {
  if (!platform) throw new Error('Platform instance is required');
  const e2eModels = getE2eModelsOverride();
  if (e2eModels) await installE2eTimelineSkill(platform);
  const config = await createAgentConfig({
    providers: loadWebProviders(),
    model: model || '',
    platform,
    searchEndpoint: loadString(LS_SEARCH_ENDPOINT),
    workingDir: '/',
    skillPaths: SKILL_PATHS,
    registerBuiltinSkills: false,
    mcpServers: loadWebMcpServers(),
    imageProviders: {
      stabilityKey: loadString('agent-web:stability_key'),
      googleKey: loadString('agent-web:google_key'),
    },
    storageNamespace: 'agent-web',
    piProvider: e2eModels?.piProvider,
    ...(e2eModels && isE2eMemoryDisabled() ? { features: { memory: false } } : {}),
  });
  const reasoningEffort = getE2eReasoningEffort();
  if (e2eModels) {
    registerE2eTimelineTool(config.toolRegistry);
    config.capabilities?.permissionManager?.addRule({ tool: 'e2e_command', effect: 'allow' });
    config.capabilities?.permissionManager?.addRule({ tool: 'file_edit', effect: 'allow' });
    config.capabilities?.permissionManager?.addRule({ tool: 'file_read', effect: 'allow' });
    config.capabilities?.permissionManager?.addRule({ tool: 'list_files', effect: 'allow' });
    config.capabilities?.permissionManager?.addRule({
      tool: 'e2e_approval', effect: 'ask', sessionScopeKey: 'e2e.approval',
    });
  }
  const postTurnMemoryTimeoutMs = getE2ePostTurnMemoryTimeoutMs();
  return {
    ...config,
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(postTurnMemoryTimeoutMs !== undefined ? { postTurnMemoryTimeoutMs } : {}),
  };
}
