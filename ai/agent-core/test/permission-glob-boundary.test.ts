import { describe, expect, it } from 'vitest';
import { PermissionManager } from '../src/permission/manager';
import type { ToolCall } from '../src/tool/types';

function bashCall(command: string): ToolCall {
  return {
    id: 'call-1',
    name: 'bash',
    arguments: { command },
  };
}

describe('PermissionManager glob rule boundaries', () => {
  it('treats regexp metacharacters in specifiers as literal text', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash({"command":"git.status"})', effect: 'deny' }],
    });

    expect(pm.check(bashCall('git.status')).allowed).toBe(false);

    const decision = pm.check(bashCall('gitXstatus'));
    expect(decision.allowed).toBe(true);
    expect(decision.needsApproval).toBe(true);
  });

  it('does not throw when specifiers include regexp syntax characters', () => {
    const pm = new PermissionManager({
      mode: 'default',
      rules: [{ tool: 'bash({"command":"git [status]"})', effect: 'deny' }],
    });

    expect(() => pm.check(bashCall('git [status]'))).not.toThrow();
    expect(pm.check(bashCall('git [status]')).allowed).toBe(false);
  });
});
