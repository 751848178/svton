/**
 * Desktop config store — reads/writes ~/.svton/config.toml
 * Mirrors Codex's config approach: TOML file, edited in system editor.
 */

import * as TOML from 'smol-toml';
import type { TauriPlatform } from '@svton/agent-platform';
import { buildEnsureDirCommand, buildOpenPathCommand, readNavigatorPlatform } from './config-store-command.utils';

export interface SvtonConfig {
  model: {
    name: string;
    provider: string;
  };
  providers: Record<
    string,
    {
      type: 'openai' | 'anthropic';
      base_url: string;
      api_key: string;
      models: Record<string, string>; // id → display name
    }
  >;
}

export interface LoadConfigResult {
  config: SvtonConfig | null;
  error?: string; // TOML parse error message
}

const CONFIG_DIR_NAME = '.svton';
const CONFIG_FILE_NAME = 'config.toml';

async function readTauriEnv(key: string): Promise<string | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string | null>('process_get_env', { key });
  } catch {
    return null;
  }
}

/** Get home directory from platform env, then Tauri backend when available. */
async function getHomeDir(platform: TauriPlatform): Promise<string | null> {
  const platformHome = platform.process.getEnv('HOME') || platform.process.getEnv('USERPROFILE');
  if (platformHome) return platformHome;
  return await readTauriEnv('HOME') || await readTauriEnv('USERPROFILE');
}

/** Resolve ~/.svton/ directory path */
async function getConfigDir(platform: TauriPlatform): Promise<string> {
  const home = await getHomeDir(platform);
  if (!home) throw new Error('Desktop config is only available when a home directory can be resolved');
  const sep = home.includes('\\') ? '\\' : '/';
  return `${home}${sep}${CONFIG_DIR_NAME}`;
}

/** Resolve ~/.svton/config.toml path */
export async function getConfigPath(platform: TauriPlatform): Promise<string> {
  const dir = await getConfigDir(platform);
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${dir}${sep}${CONFIG_FILE_NAME}`;
}

/** Load and parse config file */
export async function loadConfig(platform: TauriPlatform): Promise<LoadConfigResult> {
  let path: string;
  try {
    path = await getConfigPath(platform);
  } catch (err: any) {
    return { config: null, error: err?.message || String(err) };
  }
  const exists = await platform.fs.exists(path);
  if (!exists) return { config: null };

  const content = await platform.fs.readFile(path);
  if (!content || content.trim().length === 0) return { config: null };

  try {
    const parsed = TOML.parse(content) as unknown as SvtonConfig;
    // Basic validation
    if (!parsed.model || !parsed.providers) {
      return { config: null, error: 'Config file missing [model] or [providers] section' };
    }
    return { config: parsed };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return { config: null, error: `TOML parse error: ${msg}` };
  }
}

/** Serialize and write config file */
export async function saveConfig(platform: TauriPlatform, config: SvtonConfig): Promise<void> {
  const dir = await getConfigDir(platform);
  const path = await getConfigPath(platform);

  // Ensure directory exists
  const dirExists = await platform.fs.exists(dir);
  if (!dirExists) {
    await platform.process.exec(buildEnsureDirCommand(dir, readNavigatorPlatform()));
  }

  const content = TOML.stringify(config as any);
  await platform.fs.writeFile(path, content);
}

/** Create default config with commented-out API keys */
export async function createDefaultConfig(platform: TauriPlatform): Promise<void> {
  const dir = await getConfigDir(platform);
  const path = await getConfigPath(platform);

  // Ensure directory exists
  const dirExists = await platform.fs.exists(dir);
  if (!dirExists) {
    await platform.process.exec(buildEnsureDirCommand(dir, readNavigatorPlatform()));
  }

  // Only create if file doesn't exist
  const fileExists = await platform.fs.exists(path);
  if (fileExists) return;

  const template = `# Svton Desktop Configuration
# Edit this file to configure your model providers and API keys.
# Config path: ~/.svton/config.toml
#
# After editing, press Cmd+R (or click "Reload") in the app to apply changes.

[model]
name = "claude-sonnet-4-20250514"
provider = "anthropic"

# ── Providers ──────────────────────────────────────────
# Each provider has: type, base_url, api_key, and models.
# Uncomment and fill in the api_key for the provider you want to use.

[providers.openai]
type = "openai"
base_url = "https://api.openai.com"
api_key = ""  # Fill in your OpenAI API key: sk-...

[providers.openai.models]
gpt-4o = "GPT-4o"
gpt-4o-mini = "GPT-4o Mini"

[providers.anthropic]
type = "anthropic"
base_url = "https://api.anthropic.com"
api_key = ""  # Fill in your Anthropic API key: sk-ant-...

[providers.anthropic.models]
claude-sonnet-4-20250514 = "Claude Sonnet 4"
claude-haiku-4-20250506 = "Claude Haiku 4"

[providers.deepseek]
type = "openai"
base_url = "https://api.deepseek.com"
api_key = ""

[providers.deepseek.models]
deepseek-chat = "DeepSeek Chat"
`;

  await platform.fs.writeFile(path, template);
}

/** Open config file in system editor */
export async function openConfigInEditor(platform: TauriPlatform): Promise<void> {
  const path = await getConfigPath(platform);
  await platform.process.exec(buildOpenPathCommand(path, readNavigatorPlatform()));
}
