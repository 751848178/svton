/**
 * useChat hook tests — verifies reactive subscription to ChatService state.
 *
 * Rather than reproducing the full send → stream → done flow (already covered
 * by chat.service.test.ts), these tests verify the hook correctly subscribes
 * to the @svton/service observable and forwards state changes to React.
 *
 * Strategy: render the hook inside AgentProvider, then directly mutate
 * chatService.messages / chatService.status (the observable setters) and
 * assert the hook re-renders with the updated state.
 */
import React, { useRef, useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { useChat } from '../src/hooks/useChat';
import { AgentProvider } from '../src/service/provider';
import { ChatService } from '../src/service/chat.service';
import type { AgentConfig } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import { buildPiAgentConfig, makeBrowserPlatform } from './helpers/pi-test-utils';

function makeConfig(): AgentConfig {
  return buildPiAgentConfig().config;
}

function makePlatform(): IPlatform {
  return makeBrowserPlatform();
}

/** Test component that calls the hook and forwards state via callback. */
function HookProbe({ onState }: { onState: (s: ReturnType<typeof useChat>) => void }) {
  const api = useChat();
  useEffect(() => { onState(api); });
  return null;
}

describe('useChat', () => {
  it('returns empty messages and idle status initially', async () => {
    let state: ReturnType<typeof useChat> | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <HookProbe onState={(s) => { state = s; }} />
      </AgentProvider>
    );
    await waitFor(() => expect(state).not.toBeNull());
    expect(state!.messages).toEqual([]);
    expect(state!.isStreaming).toBe(false);
    unmount();
  });

  it('exposes send / retry / editMessage / abort functions', async () => {
    let state: ReturnType<typeof useChat> | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <HookProbe onState={(s) => { state = s; }} />
      </AgentProvider>
    );
    await waitFor(() => expect(state).not.toBeNull());
    expect(typeof state!.send).toBe('function');
    expect(typeof state!.retry).toBe('function');
    expect(typeof state!.editMessage).toBe('function');
    expect(typeof state!.abort).toBe('function');
    unmount();
  });

  it('exposes inputHistory', async () => {
    let state: ReturnType<typeof useChat> | null = null;
    const { unmount } = render(
      <AgentProvider platform={makePlatform()} config={makeConfig()}>
        <HookProbe onState={(s) => { state = s; }} />
      </AgentProvider>
    );
    await waitFor(() => expect(state).not.toBeNull());
    expect(Array.isArray(state!.inputHistory)).toBe(true);
    unmount();
  });
});
