import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityIndicator } from '../src/components/chat/ActivityIndicator';

describe('ActivityIndicator', () => {
  it('shows generic thinking label when no activeSkills', () => {
    render(<ActivityIndicator />);
    // i18n default 'chat.thinking' = "思考中..." (zh) or "Thinking..." (en)
    // We just assert a non-empty shimmering label renders.
    const label = screen.getByText(/思考中|Thinking/);
    expect(label).toBeInTheDocument();
  });

  it('shows "正在使用 <skill>" when activeSkills provided', () => {
    render(<ActivityIndicator activeSkills={['code-review']} />);
    expect(screen.getByText(/code-review/)).toBeInTheDocument();
  });

  it('joins multiple skills with comma', () => {
    render(<ActivityIndicator activeSkills={['code-review', 'plan-before-code']} />);
    expect(screen.getByText(/code-review.*plan-before-code|plan-before-code.*code-review/)).toBeInTheDocument();
  });

  it('explicit text overrides derived label', () => {
    render(<ActivityIndicator text="custom status" />);
    expect(screen.getByText('custom status')).toBeInTheDocument();
  });

  it('applies shimmer + cursor-pointer classes (clickable, animated)', () => {
    const { container } = render(<ActivityIndicator />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('cursor-pointer');
    // shimmer text uses bg-clip-text
    expect(el.innerHTML).toContain('bg-clip-text');
    expect(el.innerHTML).toContain('animate-[shimmer');
  });

  it('uses the ✦ leading glyph', () => {
    render(<ActivityIndicator />);
    expect(screen.getByText('✦')).toBeInTheDocument();
  });
});
