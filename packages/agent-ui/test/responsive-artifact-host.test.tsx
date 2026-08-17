import type { ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@svton/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveArtifactHost } from '../src/components/artifacts/ResponsiveArtifactHost';
import { MIN_ARTIFACT_SPLIT_WIDTH } from '../src/components/artifacts/use-measured-artifact-layout';
import type {
  ArtifactInteraction,
  ArtifactPanelRecord,
  ArtifactPanelState,
} from '../src/components/artifacts/artifact.types';

const renderZh = (element: ReactElement) => render(
  <LocaleProvider locale="zh">{element}</LocaleProvider>,
);

function record(): ArtifactPanelRecord {
  return {
    target: {
      id: 'document:responsive', kind: 'document', title: 'Responsive document',
      format: 'markdown', content: '# Initial',
    },
    baseline: '# Initial',
    draft: '# Initial',
    draftState: 'clean',
  };
}

function interaction(active: ArtifactPanelRecord | null): ArtifactInteraction {
  const state: ArtifactPanelState = {
    active, confirmation: null, pending: false, result: null,
  };
  return {
    state,
    createOperationId: () => 'artifact-layout-op',
    dispatch: vi.fn(async (intent) => ({ id: intent.id, kind: 'succeeded', message: 'done' })),
    updateDraft: vi.fn(),
    resolveOpenCapability: () => ({ supported: false, reason: 'unsupported' }),
  };
}

describe('ResponsiveArtifactHost', () => {
  let resize: ResizeObserverCallback | null;

  beforeEach(() => {
    resize = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  const emitWidth = (width: number) => {
    resize?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
  };

  it('keeps compact and medium artifact replacement single-pane even with ample host width', async () => {
    for (const width of [390, 768]) {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      const rendered = renderZh(
        <ResponsiveArtifactHost
          interaction={interaction(record())}
          chat={<button type="button">Chat action</button>}
        />,
      );
      emitWidth(1400);
      const host = screen.getByTestId('artifact-test-host');
      await waitFor(() => expect(host).toHaveAttribute('data-artifact-layout', 'artifact'));
      const chat = host.querySelector<HTMLElement>('[data-artifact-chat-pane]')!;
      expect(chat).toHaveAttribute('aria-hidden', 'true');
      expect(chat).toHaveAttribute('inert');
      expect(screen.getAllByRole('button', { name: /内容面板/ })).toHaveLength(1);
      expect(screen.getByRole('button', { name: '返回对话并关闭内容面板' })).toBeVisible();
      const hiddenAction = within(chat).getByRole('button', { name: 'Chat action', hidden: true });
      screen.getByRole('button', { name: '返回对话并关闭内容面板' }).focus();
      await userEvent.tab();
      expect(hiddenAction).not.toHaveFocus();
      rendered.unmount();
    }
  });

  it('splits only at the measured wide threshold and preserves pane state across reflow', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    renderZh(
      <ResponsiveArtifactHost
        interaction={interaction(record())}
        chat={<div data-testid="chat-scroll"><button type="button">Chat action</button></div>}
      />,
    );
    const host = screen.getByTestId('artifact-test-host');
    emitWidth(MIN_ARTIFACT_SPLIT_WIDTH - 1);
    await waitFor(() => expect(host).toHaveAttribute('data-artifact-layout', 'artifact'));
    expect(screen.getAllByRole('button', { name: /内容面板/ })).toHaveLength(1);

    emitWidth(MIN_ARTIFACT_SPLIT_WIDTH);
    await waitFor(() => expect(host).toHaveAttribute('data-artifact-layout', 'split'));
    expect(screen.getAllByRole('button', { name: /内容面板/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '关闭内容面板' })).toBeVisible();
    const chatPane = host.querySelector<HTMLElement>('[data-artifact-chat-pane]')!;
    expect(chatPane).not.toHaveAttribute('aria-hidden');
    expect(chatPane).not.toHaveAttribute('inert');

    await userEvent.click(screen.getByRole('tab', { name: '编辑' }));
    const editTab = screen.getByRole('tab', { name: '编辑' });
    const editor = screen.getByRole('textbox', { name: '编辑 Responsive document' });
    const chatScroll = screen.getByTestId('chat-scroll');
    chatScroll.scrollTop = 91;
    editor.scrollTop = 37;
    const chatAction = screen.getByRole('button', { name: 'Chat action' });
    chatAction.focus();

    emitWidth(MIN_ARTIFACT_SPLIT_WIDTH - 1);
    await waitFor(() => expect(host).toHaveAttribute('data-artifact-layout', 'artifact'));
    expect(editTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Responsive document' })).toHaveFocus());
    expect(chatAction).not.toHaveFocus();
    expect(editor.scrollTop).toBe(37);
    expect(chatScroll.scrollTop).toBe(91);
    expect(screen.getAllByRole('button', { name: /内容面板/ })).toHaveLength(1);
  });

  it('makes the empty artifact pane inert and absent from accessibility in chat mode', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    renderZh(
      <ResponsiveArtifactHost
        interaction={interaction(null)}
        chat={<button type="button">Chat action</button>}
      />,
    );
    const host = screen.getByTestId('artifact-test-host');
    const artifact = host.querySelector<HTMLElement>('[data-artifact-content-pane]')!;
    expect(host).toHaveAttribute('data-artifact-layout', 'chat');
    expect(artifact).toHaveAttribute('aria-hidden', 'true');
    expect(artifact).toHaveAttribute('inert');
    expect(within(artifact).queryByRole('button', { hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat action' })).toBeVisible();
  });
});
