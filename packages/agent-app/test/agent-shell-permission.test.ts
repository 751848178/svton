import { describe, expect, it } from 'vitest';
import { PermissionManager } from '@svton/agent-core';
import type { AgentConfig } from '@svton/agent-core';
import { readAgentShellPermissionMode } from '../src/components/agent-shell-permission.utils';

function makeConfig(mode?: string): AgentConfig {
  return {
    provider: {} as any,
    model: 'test-model',
    toolRegistry: {} as any,
    workingDir: '/',
    capabilities: mode
      ? { permissionManager: new PermissionManager({ mode: mode as any }) }
      : {},
  };
}

describe('readAgentShellPermissionMode', () => {
  it('reads the current mode from PermissionManager', () => {
    expect(readAgentShellPermissionMode(makeConfig('auto'))).toBe('auto');
    expect(readAgentShellPermissionMode(makeConfig('plan'))).toBe('plan');
  });

  it('falls back to default when the config has no permission manager', () => {
    expect(readAgentShellPermissionMode(makeConfig())).toBe('default');
  });
});
