import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage } from '../src/components/chat/ChatMessage';
import type { ArtifactInteraction } from '../src/components/artifacts/artifact.types';

function artifactInteraction(dispatch = vi.fn(async (intent) => ({ id: intent.id, kind: 'succeeded' as const, message: 'opened' }))): ArtifactInteraction {
  return {
    state: { active: null, confirmation: null, result: null, pending: false },
    createOperationId: () => 'open-operation', dispatch,
    updateDraft: vi.fn(), resolveOpenCapability: () => ({ supported: true }),
  };
}

describe('chat artifact action wiring', () => {
  it('opens duplicate display paths with distinct message/block identities and full locations', () => {
    const dispatch = vi.fn(async (intent) => ({ id: intent.id, kind: 'succeeded' as const, message: 'opened' }));
    render(<ChatMessage id="message-9" role="assistant" content="" artifactInteraction={artifactInteraction(dispatch)} blocks={[
      { type: 'reference', refs: [{ path: '/a/same.ts', line: 4 }, { path: '/b/same.ts', line: 9 }] },
    ]} />);
    fireEvent.click(screen.getByText(/已处理|Processed/));
    fireEvent.click(screen.getByTitle('/a/same.ts'));
    fireEvent.click(screen.getByTitle('/b/same.ts'));
    expect(dispatch.mock.calls.map(([intent]) => intent.target)).toEqual([
      expect.objectContaining({ id: 'message-9:block:0:reference:0', path: '/a/same.ts', line: 4 }),
      expect.objectContaining({ id: 'message-9:block:0:reference:1', path: '/b/same.ts', line: 9 }),
    ]);
  });

  it('routes Markdown code preview through one typed artifact intent', () => {
    const dispatch = vi.fn(async (intent) => ({ id: intent.id, kind: 'succeeded' as const, message: 'opened' }));
    const view = render(<ChatMessage id="message-code" role="assistant" content={'```js\nconsole.log(1)\n```'} artifactInteraction={artifactInteraction(dispatch)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open content panel: js' }));
    view.rerender(<ChatMessage id="message-code" role="assistant" content={'```js\nconsole.log(1)\n```'} artifactInteraction={artifactInteraction(dispatch)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open content panel: js' }));
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0].target).toMatchObject({
      kind: 'code', id: 'message-code:content:code:0', language: 'js', content: 'console.log(1)',
    });
    expect(dispatch.mock.calls[1][0].target).toEqual(dispatch.mock.calls[0][0].target);
  });
});
