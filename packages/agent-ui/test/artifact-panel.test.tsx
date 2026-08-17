import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ArtifactDirtyDialog } from '../src/components/artifacts/ArtifactDirtyDialog';
import { ArtifactEditableView } from '../src/components/artifacts/ArtifactEditableView';
import { ArtifactPanel } from '../src/components/artifacts/ArtifactPanel';
import { ArtifactHostStatus } from '../src/components/artifacts/ArtifactHostStatus';
import type { ArtifactInteraction, ArtifactPanelState } from '../src/components/artifacts/artifact.types';

const target = { kind: 'document' as const, id: 'm:block:doc', title: 'Doc', format: 'markdown' as const, content: 'source' };
function interaction(state: Partial<ArtifactPanelState> = {}): ArtifactInteraction {
  return {
    state: { active: { target, baseline: 'source', draft: 'source', draftState: 'clean' }, confirmation: null, result: null, pending: false, ...state },
    createOperationId: () => 'operation', dispatch: vi.fn(async () => ({ id: 'operation', kind: 'succeeded', message: 'done' })),
    updateDraft: vi.fn(), resolveOpenCapability: () => ({ supported: true }),
  };
}

describe('artifact panel accessibility and draft preview', () => {
  it('uses unique complete keyboard tabs and disables no-op Save', async () => {
    const user = userEvent.setup();
    render(<><ArtifactPanel interaction={interaction()} /><ArtifactPanel interaction={interaction()} /></>);
    const previewTabs = screen.getAllByRole('tab', { name: 'Preview' });
    expect(previewTabs[0].id).not.toBe(previewTabs[1].id);
    expect(screen.getAllByRole('button', { name: 'Save draft' })[0]).toBeDisabled();
    previewTabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getAllByRole('tab', { name: 'Edit' })[0]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(previewTabs[0]).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getAllByRole('tab', { name: 'Edit' })[0]).toHaveFocus();
  });

  it('traps focus in dirty confirmation and handles Escape as cancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ArtifactDirtyDialog confirmation={{ kind: 'close' }} onCancel={onCancel} onDiscard={vi.fn()} />);
    const cancel = screen.getByRole('button', { name: 'Continue editing' });
    const discard = screen.getByRole('button', { name: 'Discard changes' });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(discard).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('makes panel content inert behind confirmation', () => {
    render(<ArtifactPanel interaction={interaction({ confirmation: { kind: 'close' } })} />);
    const hidden = screen.getByLabelText('Artifact panel').querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(hidden?.inert).toBe(true);
  });

  it('feeds current drafts to live preview and labels unsupported code honestly', () => {
    const props = { mode: 'preview' as const, onChange: vi.fn(), previewTabId: 'pt', previewPanelId: 'pp', editTabId: 'et', editPanelId: 'ep' };
    const { rerender } = render(<ArtifactEditableView {...props} target={{ kind: 'code', id: 'c', title: 'JS', language: 'js', content: 'old' }} draft="console.log('current')" />);
    expect(screen.getByTitle('Code preview')).toHaveAttribute('srcdoc', expect.stringContaining("console.log('current')"));
    rerender(<ArtifactEditableView {...props} target={{ kind: 'code', id: 'c', title: 'TSX', language: 'tsx', content: 'old' }} draft="const App = () => <div />" />);
    expect(screen.getByText(/Source preview/)).toBeInTheDocument();
    expect(screen.queryByTitle('Code preview')).not.toBeInTheDocument();
  });

  it('updates the current draft from the editor panel', () => {
    const onChange = vi.fn();
    render(<ArtifactEditableView target={target} draft="latest" mode="edit" onChange={onChange} previewTabId="pt" previewPanelId="pp" editTabId="et" editPanelId="ep" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new draft' } });
    expect(onChange).toHaveBeenCalledWith('new draft');
  });

  it('announces host-only outcomes when no panel is mounted', () => {
    const hostInteraction = interaction({
      active: null,
      result: { id: 'popout', kind: 'succeeded', message: '已在只读预览窗口打开。' },
    });
    render(<ArtifactHostStatus interaction={hostInteraction} />);
    expect(screen.getByRole('status')).toHaveTextContent('只读预览窗口');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss status' }));
    expect(hostInteraction.dispatch).toHaveBeenCalledWith({ id: 'operation', kind: 'artifact.result.dismiss' });
  });

  it('announces failed host-only outcomes as alerts', () => {
    render(<ArtifactHostStatus interaction={interaction({
      active: null,
      result: { id: 'failed', kind: 'failed', retryable: true, message: '窗口打开失败。' },
    })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('窗口打开失败');
  });
});
