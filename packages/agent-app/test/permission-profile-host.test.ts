import { describe, expect, it, vi } from 'vitest';
import type { ISettingsAdapter } from '@svton/agent-ui';
import { createAgentAppPermissionProfileHost } from '../src/models/agent-app-permission-profile-host';

describe('AgentApp permission profile host', () => {
  it('uses the settings adapter durable mirror and awaits writes', async () => {
    let persisted = 'default';
    const savePermissionMode = vi.fn(async (mode: string) => { persisted = mode; });
    const host = createAgentAppPermissionProfileHost({
      getPermissionMode: () => persisted,
      savePermissionMode,
    } as ISettingsAdapter);

    await host.persistDefault('accept_edits');
    expect(savePermissionMode).toHaveBeenCalledWith('accept_edits');
    expect(host.getPersisted()).toBe('accept_edits');
  });
});
