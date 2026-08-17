import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useInert } from '../src/components/use-inert';

type InertElement = HTMLDivElement & { inert: boolean };

function Fixture({ active, initiallyInert = false }: {
  active: boolean;
  initiallyInert?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  useInert(ref, active);
  return (
    <div
      data-testid="surface"
      ref={(node) => {
        ref.current = node;
        if (!node || initialized.current) return;
        initialized.current = true;
        (node as InertElement).inert = initiallyInert;
        if (initiallyInert) node.setAttribute('inert', '');
      }}
    />
  );
}

describe('useInert', () => {
  it('removes only the inert state that it owns', () => {
    const rendered = render(<Fixture active />);
    const surface = screen.getByTestId('surface') as InertElement;
    expect(surface.inert).toBe(true);
    rendered.rerender(<Fixture active={false} />);
    expect(surface.inert).toBe(false);
    expect(surface).not.toHaveAttribute('inert');
  });

  it('restores an outer inert owner instead of forcing false', () => {
    const rendered = render(<Fixture active initiallyInert />);
    const surface = screen.getByTestId('surface') as InertElement;
    rendered.rerender(<Fixture active={false} initiallyInert />);
    expect(surface.inert).toBe(true);
    expect(surface).toHaveAttribute('inert');
  });
});
