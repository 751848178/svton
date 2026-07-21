import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

export function mockCdpClient(
  responses: Record<string, (params: Record<string, unknown>) => any> = {},
) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  return {
    calls,
    async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
      calls.push({ method, params });
      const handler = responses[method];
      if (handler) return handler(params);
      return {};
    },
  };
}

export const chromeCtx: ToolContext = {
  platform: createMockPlatform(),
  sessionId: 's',
  workingDir: '/',
};

export function makeChromeCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: 'c1', name, arguments: args };
}
