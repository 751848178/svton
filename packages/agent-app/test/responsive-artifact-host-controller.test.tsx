import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResponsiveArtifactHost } from '@svton/agent-ui';
import { LocaleProvider } from '@svton/ui';
import { beforeEach, describe, expect, it } from 'vitest';
import { useArtifactController } from '../src/artifacts/use-artifact-controller';

const target = {
  id: 'reference:focus-owner',
  kind: 'reference' as const,
  path: '/workspace/focus-owner.ts',
  snippet: 'const focusOwner = true;',
};

function Harness() {
  const artifact = useArtifactController();
  return (
    <ResponsiveArtifactHost
      interaction={artifact}
      chat={(
        <div data-testid="chat-scroll" className="overflow-auto">
          <button
            type="button"
            data-artifact-target-id={target.id}
            onClick={() => void artifact.dispatch({
              id: artifact.createOperationId(), kind: 'artifact.open', target,
            })}
          >
            Open exact artifact
          </button>
          <label htmlFor="preserved-composer">Composer draft</label>
          <textarea id="preserved-composer" />
        </div>
      )}
    />
  );
}

describe('ResponsiveArtifactHost with the accepted controller', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  });

  it('keeps chat draft and scroll mounted and restores the exact opener after close', async () => {
    render(<LocaleProvider locale="zh"><Harness /></LocaleProvider>);
    const composer = screen.getByRole('textbox', { name: 'Composer draft' });
    const scroll = screen.getByTestId('chat-scroll');
    const opener = screen.getByRole('button', { name: 'Open exact artifact' });
    await userEvent.type(composer, 'preserved draft');
    scroll.scrollTop = 73;
    await userEvent.click(opener);
    expect(screen.getByTestId('artifact-test-host').getAttribute('data-artifact-layout')).toBe('artifact');
    await userEvent.click(screen.getByRole('button', { name: '返回对话并关闭内容面板' }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect((composer as HTMLTextAreaElement).value).toBe('preserved draft');
    expect(scroll.scrollTop).toBe(73);
    expect(screen.getByTestId('artifact-test-host').getAttribute('data-artifact-layout')).toBe('chat');
  });
});
