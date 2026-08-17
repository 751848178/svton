import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Modal } from '../src/components/Modal';

function externalOpener(): HTMLButtonElement {
  const app = document.createElement('main');
  app.dataset.testExternal = 'app';
  const opener = document.createElement('button');
  opener.textContent = 'External opener';
  app.appendChild(opener);
  document.body.appendChild(app);
  opener.focus();
  return opener;
}

describe('Modal accessibility contract', () => {
  it('registers initial open, names content, focuses safely, and restores exact opener', async () => {
    const opener = externalOpener();
    document.body.style.overflow = 'clip';
    const view = render(
      <Modal
        open
        onClose={() => undefined}
        title={<span>Dangerous action</span>}
        description="Review the effect"
        initialFocusSelector="[data-safe]"
      >
        <button type="button">Risky</button>
        <button type="button" data-safe>Safe</button>
      </Modal>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Dangerous action' });
    expect(dialog).toHaveAccessibleDescription('Review the effect');
    expect(screen.getByRole('button', { name: 'Safe' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    expect((opener.parentElement as HTMLElement & { inert: boolean }).inert).toBe(true);

    view.rerender(<Modal open={false} onClose={() => undefined} title="Closed">x</Modal>);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('clip');
    expect(opener.parentElement).not.toHaveAttribute('inert');
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('loops Tab in both directions and follows explicit mask and Escape policy', async () => {
    externalOpener();
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Policy"><button>First</button><button>Last</button></Modal>);
    const dialog = await screen.findByRole('dialog');
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    const close = screen.getByRole('button', { name: 'Close' });
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(document.querySelector('[data-svton-modal-layer] > [aria-hidden="true"]')!);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(first).toBeInTheDocument();
  });

  it('keeps a forbidden top Escape from falling through', async () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    render(<><Modal open onClose={outerClose} title="Outer"><button>Outer action</button></Modal><Modal open onClose={innerClose} closeOnEscape={false} title="Inner"><button>Inner action</button></Modal></>);
    await screen.findByRole('dialog', { name: 'Inner' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(innerClose).not.toHaveBeenCalled();
    expect(outerClose).not.toHaveBeenCalled();
  });
});
