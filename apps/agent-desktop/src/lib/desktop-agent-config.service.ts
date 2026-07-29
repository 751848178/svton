import type { TauriPlatform } from '@svton/agent-platform';
import {
  loadConfig,
  type LoadConfigResult,
} from './config-store';
import {
  desktopE2eActive,
  desktopE2eTomlConfig,
} from './e2e-provider';

/** Selects config without touching the real config file in Desktop E2E mode. */
export function loadDesktopAgentConfig(
  platform: TauriPlatform,
): Promise<LoadConfigResult> {
  if (desktopE2eActive()) {
    return Promise.resolve({ config: desktopE2eTomlConfig() });
  }
  return loadConfig(platform);
}
