import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDesktopE2eDrive } from '@/lib/desktop-e2e-drive.service';
import { DESKTOP_E2E_RESULT_PATH } from '@/lib/desktop-e2e-evidence.service';
import {
  DESKTOP_E2E_MARKER,
  DESKTOP_E2E_MODEL,
  DESKTOP_E2E_USER_MESSAGE,
} from '@/lib/e2e-provider';
import { makeDesktopE2ePlatform } from './desktop-e2e-platform.fixture';

describe('Desktop E2E drive', () => {
  beforeEach(() => {
    delete (window as any).__SVTON_DESKTOP_E2E_QUEUE__;
    delete (window as any).__svtonDesktopE2e__;
  });

  it('waits for readiness, sends once, and writes terminal evidence', async () => {
    const { platform, writes } = makeDesktopE2ePlatform();
    let model = '';
    let status = 'idle';
    const messages: Array<{ role: string; content: unknown }> = [];
    const send = vi.fn(async (content: string) => {
      status = 'running';
      messages.push({ role: 'user', content });
      messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: `done [${DESKTOP_E2E_MARKER}]` }],
      });
      status = 'idle';
    });
    setTimeout(() => { model = DESKTOP_E2E_MODEL; }, 5);

    const evidence = await runDesktopE2eDrive({
      platform,
      getModel: () => model,
      getMessages: () => messages,
      getStatus: () => status,
      send,
    }, { timeoutMs: 500, pollIntervalMs: 2 });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(DESKTOP_E2E_USER_MESSAGE);
    expect(evidence).toMatchObject({
      state: 'passed',
      ok: true,
      finalStatus: 'idle',
      baselineMessageCount: 0,
      hasUserMessage: true,
      hasAssistantMarker: true,
      messageCount: 2,
      userMessageCount: 1,
      markerCount: 1,
      newMessageCount: 2,
      newUserMessageCount: 1,
      newMarkerCount: 1,
    });
    expect(JSON.parse(writes.get(DESKTOP_E2E_RESULT_PATH)!)).toMatchObject({
      state: 'passed',
      ok: true,
    });
  });

  it('does not reuse restored matching messages when send adds nothing', async () => {
    const { platform, writes } = makeDesktopE2ePlatform();
    const messages = [
      { role: 'user', content: DESKTOP_E2E_USER_MESSAGE },
      { role: 'assistant', content: `old [${DESKTOP_E2E_MARKER}]` },
    ];
    const send = vi.fn(async () => {});

    const evidence = await runDesktopE2eDrive({
      platform,
      getModel: () => DESKTOP_E2E_MODEL,
      getMessages: () => messages,
      getStatus: () => 'idle',
      send,
    }, { timeoutMs: 5, pollIntervalMs: 1 });

    expect(send).toHaveBeenCalledTimes(1);
    expect(evidence).toMatchObject({
      state: 'failed',
      baselineMessageCount: 2,
      userMessageCount: 1,
      markerCount: 1,
      newMessageCount: 0,
      newUserMessageCount: 0,
      newMarkerCount: 0,
      hasUserMessage: false,
      hasAssistantMarker: false,
    });
    expect(JSON.parse(writes.get(DESKTOP_E2E_RESULT_PATH)!)).toMatchObject({
      state: 'failed',
      baselineMessageCount: 2,
      newMessageCount: 0,
    });
  });

  it('bounds a send promise and persists terminal failure', async () => {
    const { platform, writes } = makeDesktopE2ePlatform();
    const send = vi.fn(() => new Promise<void>(() => {}));
    const evidence = await runDesktopE2eDrive({
      platform,
      getModel: () => DESKTOP_E2E_MODEL,
      getMessages: () => [],
      getStatus: () => 'idle',
      send,
    }, { timeoutMs: 5, pollIntervalMs: 1 });

    expect(send).toHaveBeenCalledTimes(1);
    expect(evidence.error).toContain('send completion');
    expect(JSON.parse(writes.get(DESKTOP_E2E_RESULT_PATH)!)).toMatchObject({
      state: 'failed',
      ok: false,
    });
  });

  it('persists terminal failure when a running send is cancelled', async () => {
    const { platform, writes } = makeDesktopE2ePlatform();
    const controller = new AbortController();
    const run = runDesktopE2eDrive({
      platform,
      getModel: () => DESKTOP_E2E_MODEL,
      getMessages: () => [],
      getStatus: () => 'idle',
      send: () => new Promise<void>(() => {}),
    }, { signal: controller.signal, timeoutMs: 500, pollIntervalMs: 1 });
    setTimeout(() => controller.abort(), 5);

    const evidence = await run;
    expect(evidence.state).toBe('failed');
    expect(evidence.error).toContain('cancelled');
    expect(JSON.parse(writes.get(DESKTOP_E2E_RESULT_PATH)!)).toMatchObject({
      state: 'failed',
    });
  });

  it('fails without sending when readiness times out', async () => {
    const { platform, writes } = makeDesktopE2ePlatform();
    const send = vi.fn();
    const evidence = await runDesktopE2eDrive({
      platform,
      getModel: () => '',
      getMessages: () => [],
      getStatus: () => 'idle',
      send,
    }, { timeoutMs: 5, pollIntervalMs: 1 });

    expect(send).not.toHaveBeenCalled();
    expect(evidence.state).toBe('failed');
    expect(evidence.error).toContain('timed out');
    expect(JSON.parse(writes.get(DESKTOP_E2E_RESULT_PATH)!)).toMatchObject({
      state: 'failed',
      ok: false,
    });
  });
});
