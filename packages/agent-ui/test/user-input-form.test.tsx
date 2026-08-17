import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserInputForm } from '../src/components/chat/UserInputForm';
import type { UserInputRequestView } from '../src/components/chat/user-input.types';

const baseRequest: UserInputRequestView = {
  sessionId: 'session-1',
  requestId: 'request-1',
  state: 'pending',
  questions: [
    {
      id: 'token', header: 'Access token', question: 'Enter the temporary token.',
      isOther: false, isSecret: true, options: null,
    },
    {
      id: 'color', header: 'Color', question: 'Choose a color.',
      isOther: true, isSecret: false,
      options: [{ label: 'Blue', description: 'Use the blue theme.' }],
    },
  ],
};

describe('UserInputForm', () => {
  it('provides an accessible atomic form without announcing secrets', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UserInputForm request={baseRequest} onSubmit={onSubmit} />);

    expect(screen.getByRole('dialog', { name: 'Input required' })).toBeInTheDocument();
    const secret = screen.getByLabelText('Access token');
    expect(secret).toHaveAttribute('type', 'password');
    expect(secret).toHaveFocus();
    expect(secret.getAttribute('aria-describedby')).toContain('token-description');

    await user.click(screen.getByRole('button', { name: 'Submit answers' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    await user.type(secret, 'private-value');
    await user.click(screen.getByRole('radio', { name: /Blue/ }));
    await user.click(screen.getByRole('button', { name: 'Submit answers' }));
    expect(onSubmit).toHaveBeenCalledWith('request-1', {
      token: { answers: ['private-value'] }, color: { answers: ['Blue'] },
    });
    expect(screen.getByText('Waiting for your answers.')).not.toHaveTextContent('private-value');
  });

  it('supports Other, keyboard traversal, Escape safety, and submitting state', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<UserInputForm request={{
      ...baseRequest,
      questions: [baseRequest.questions[1]],
    }} onSubmit={onSubmit} />);

    const blue = screen.getByRole('radio', { name: /Blue/ });
    expect(blue).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Color other answer')).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Other' }));
    await user.type(screen.getByLabelText('Color other answer'), 'Green');
    await user.click(screen.getByRole('button', { name: 'Submit answers' }));
    expect(onSubmit).toHaveBeenCalledWith('request-1', { color: { answers: ['Green'] } });

    rerender(<UserInputForm request={{ ...baseRequest, state: 'submitting' }} onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    expect(screen.getByLabelText('Access token')).toBeDisabled();
  });

  it('allows global focus while preserving Escape safety and focus restoration', async () => {
    const user = userEvent.setup();
    const opener = document.createElement('button');
    opener.textContent = 'Open dialog';
    document.body.append(opener);
    opener.focus();
    const onSubmit = vi.fn();
    const onAbort = vi.fn();
    const { unmount } = render(
      <UserInputForm
        request={{ ...baseRequest, draft: { color: 'Blue' } }}
        onSubmit={onSubmit}
        onAbort={onAbort}
      />,
    );

    const first = screen.getByLabelText('Access token');
    expect(first).toHaveFocus();
    expect(screen.getByRole('radio', { name: /Blue/ })).toBeChecked();
    await user.tab({ shift: true });
    expect(opener).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onAbort).not.toHaveBeenCalled();

    first.focus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
