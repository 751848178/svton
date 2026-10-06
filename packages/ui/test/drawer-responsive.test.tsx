import React from 'react';
import { render, screen } from '@testing-library/react';
import { Drawer } from '../src/components/Drawer';

describe('Drawer responsive bounds', () => {
  it('caps a desktop width to the viewport on narrow screens', async () => {
    render(
      <Drawer open title="Evidence" width={680} onClose={() => undefined}>
        Content
      </Drawer>,
    );

    const drawer = await screen.findByRole('dialog', { name: 'Evidence' });
    expect(drawer).toHaveStyle({ width: '680px', maxWidth: '100vw' });
  });
});
