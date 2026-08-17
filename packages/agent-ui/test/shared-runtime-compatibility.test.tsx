import React from 'react';
import { render, screen } from '@testing-library/react';
import { Modal, SparklesIcon } from '@svton/ui';

describe('shared UI React peer compatibility', () => {
  it('renders shared hooks and curated lucide elements with the consumer React runtime', async () => {
    render(
      <Modal open onClose={() => undefined} title="Shared runtime">
        <button type="button"><SparklesIcon aria-hidden="true" />Action</button>
      </Modal>,
    );
    expect(await screen.findByRole('dialog', { name: 'Shared runtime' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });
});
