import type { IPlatform } from '@svton/agent-platform';
import { awaitDesktopE2eDeadline } from './desktop-e2e-deadline.service';
import {
  buildDesktopE2eResult,
  captureDesktopE2eBaseline,
  persistDesktopE2eResult,
  type DesktopE2eBaseline,
  type DesktopE2eResultEvidence,
} from './desktop-e2e-evidence.service';
import type { DesktopE2eMessage } from './desktop-e2e-messages.utils';
import {
  runDesktopE2eNativeProbe,
  type DesktopE2eNativeEvidence,
} from './desktop-e2e-native.service';
import {
  DESKTOP_E2E_MARKER,
  DESKTOP_E2E_MODEL,
  DESKTOP_E2E_USER_MESSAGE,
  enqueueDesktopE2eResponse,
} from './e2e-provider';

interface DesktopE2eDriveBindings {
  platform: IPlatform;
  getModel: () => string;
  getMessages: () => readonly DesktopE2eMessage[];
  getStatus: () => string;
  send: (content: string) => Promise<void>;
}

interface DesktopE2eDriveOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_POLL_INTERVAL_MS = 25;

export async function runDesktopE2eDrive(
  bindings: DesktopE2eDriveBindings,
  options: DesktopE2eDriveOptions = {},
): Promise<DesktopE2eResultEvidence> {
  const startedAt = Date.now();
  const deadline = startedAt + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  let baseline = captureDesktopE2eBaseline(bindings.getMessages());
  let native: DesktopE2eNativeEvidence | undefined;
  try {
    await persistSnapshot(bindings, startedAt, baseline);
    await waitFor(
      () => bindings.getModel() === DESKTOP_E2E_MODEL,
      'chat service/model readiness',
      deadline,
      pollInterval,
      options.signal,
    );
    baseline = captureDesktopE2eBaseline(bindings.getMessages());
    await persistSnapshot(bindings, startedAt, baseline);
    enqueueDesktopE2eResponse();
    native = await awaitDesktopE2eDeadline(
      () => runDesktopE2eNativeProbe(bindings.platform),
      deadline,
      'native probe',
      options.signal,
    );
    if (!native.ok) {
      throw new Error(native.error || 'Native E2E probe failed');
    }
    await awaitDesktopE2eDeadline(
      () => bindings.send(DESKTOP_E2E_USER_MESSAGE),
      deadline,
      'send completion',
      options.signal,
    );
    await waitFor(
      () => turnCompleted(bindings, baseline),
      'streamed assistant turn',
      deadline,
      pollInterval,
      options.signal,
    );
    const passed = buildDesktopE2eResult(
      'passed',
      bindings.getMessages(),
      bindings.getStatus(),
      startedAt,
      undefined,
      baseline,
      native,
    );
    await persistDesktopE2eResult(bindings.platform, passed);
    return passed;
  } catch (error) {
    const failed = buildDesktopE2eResult(
      'failed',
      bindings.getMessages(),
      bindings.getStatus(),
      startedAt,
      errorText(error),
      baseline,
      native,
    );
    await persistFailureBestEffort(bindings.platform, failed);
    return failed;
  }
}

function turnCompleted(
  bindings: DesktopE2eDriveBindings,
  baseline: DesktopE2eBaseline,
): boolean {
  const result = buildDesktopE2eResult(
    'running',
    bindings.getMessages(),
    bindings.getStatus(),
    0,
    undefined,
    baseline,
  );
  return result.finalStatus === 'idle'
    && result.newMessageCount > 0
    && result.newUserMessageCount > 0
    && result.newMarkerCount > 0
    && result.hasUserMessage
    && result.hasAssistantMarker
    && result.lastAssistantMarkerIndex > result.lastUserMessageIndex;
}

async function persistSnapshot(
  bindings: DesktopE2eDriveBindings,
  startedAt: number,
  baseline: DesktopE2eBaseline,
): Promise<void> {
  await persistDesktopE2eResult(
    bindings.platform,
    buildDesktopE2eResult(
      'running',
      bindings.getMessages(),
      bindings.getStatus(),
      startedAt,
      undefined,
      baseline,
    ),
  );
}

async function persistFailureBestEffort(
  platform: IPlatform,
  failed: DesktopE2eResultEvidence,
): Promise<void> {
  try {
    await persistDesktopE2eResult(platform, failed);
  } catch (writeError) {
    const withWriteError = {
      ...failed,
      error: `${failed.error}; evidence write failed: ${errorText(writeError)}`,
    };
    if (typeof window !== 'undefined') {
      Object.assign(window, { __svtonDesktopE2e__: withWriteError });
    }
  }
}

async function waitFor(
  predicate: () => boolean,
  label: string,
  deadline: number,
  pollInterval: number,
  signal?: AbortSignal,
): Promise<void> {
  while (!predicate()) {
    if (signal?.aborted) throw new Error(`Desktop E2E cancelled during ${label}`);
    if (Date.now() >= deadline) throw new Error(`Desktop E2E timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
