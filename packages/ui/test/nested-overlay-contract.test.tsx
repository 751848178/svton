import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Drawer } from '../src/components/Drawer';
import { Modal } from '../src/components/Modal';

function NestedHarness() {
  const [modalOpen, setModalOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(true);
  return <><Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Outer"><button>Outer action</button></Modal><Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Inner"><button>Inner action</button></Drawer></>;
}

describe('nested overlay registry', () => {
  it('closes only the top layer and keeps body locked until the final close', async () => {
    document.body.style.overflow = 'scroll';
    const existing = document.createElement('aside') as HTMLElement & { inert: boolean };
    existing.dataset.testExternal = 'existing';
    existing.setAttribute('inert', 'legacy');
    existing.inert = true;
    document.body.appendChild(existing);
    render(<NestedHarness />);
    await screen.findByRole('dialog', { name: 'Inner' });
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Inner' })).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Outer' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('scroll');
    expect(existing.inert).toBe(true);
    expect(existing.getAttribute('inert')).toBe('legacy');
  });

  it('makes dynamically added body children inert and restores their original state', async () => {
    const view = render(<Drawer open onClose={() => undefined} title="Dynamic"><button>Action</button></Drawer>);
    await screen.findByRole('dialog');
    const dynamic = document.createElement('section') as HTMLElement & { inert: boolean };
    dynamic.dataset.testExternal = 'dynamic';
    document.body.appendChild(dynamic);
    await waitFor(() => expect(dynamic.inert).toBe(true));
    view.rerender(<Drawer open={false} onClose={() => undefined} title="Dynamic">closed</Drawer>);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(dynamic.inert).toBe(false);
    expect(dynamic).not.toHaveAttribute('inert');
  });
});
