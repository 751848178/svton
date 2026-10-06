import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Modal } from '../src/components/Modal';
import { Select } from '../src/components/Select';

describe('Select inside a modal layer', () => {
  it('mounts its listbox inside the active layer so inert isolation does not block options', async () => {
    const onChange = vi.fn();
    render(
      <Modal open title="Configure" onClose={() => undefined}>
        <Select
          value="none"
          options={[
            { label: 'None', value: 'none' },
            { label: 'Managed', value: 'managed' },
          ]}
          onChange={onChange}
        />
      </Modal>,
    );

    fireEvent.click(await screen.findByRole('combobox'));
    const managed = await screen.findByRole('option', { name: 'Managed' });
    expect(managed.closest('[data-svton-modal-layer]')).not.toBeNull();
    expect(managed.closest('[inert]')).toBeNull();
    fireEvent.click(managed);
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange.mock.calls[0][0].target.value).toBe('managed');
  });
});
