import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SplitScreenPanel } from '../src/components/chat/SplitScreenPanel';

const content = {
  type: 'document' as const,
  title: 'Artifact preview',
  content: '# Current artifact',
};

describe('SplitScreenPanel artifact popout capabilities', () => {
  it('renders artifact popout content as explicitly read-only without edit or export', () => {
    render(<SplitScreenPanel content={content} readOnly onClose={vi.fn()} />);
    expect(screen.getByText('只读预览')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Current artifact')).toBeInTheDocument();
  });

  it('preserves mutable controls for legacy non-artifact callers', () => {
    render(<SplitScreenPanel content={content} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox')).toHaveValue('# Current artifact');
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});
