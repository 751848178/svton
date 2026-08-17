import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewWindow } from '../src/components/PreviewWindow.component';

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock('@svton/agent-ui', () => ({
  SplitScreenPanel: (props: Record<string, unknown>) => {
    captured.props = props;
    return <div data-testid="preview-panel" />;
  },
}));

describe('PreviewWindow artifact contract', () => {
  afterEach(() => {
    captured.props = null;
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('always mounts artifact popout content through the read-only capability', async () => {
    window.history.replaceState(null, '', '/?key=artifact-test');
    localStorage.setItem('svton-preview-artifact-test', JSON.stringify({
      type: 'document', title: 'Artifact', content: 'current draft',
    }));
    render(<PreviewWindow />);
    await waitFor(() => expect(captured.props?.content).toMatchObject({ content: 'current draft' }));
    expect(captured.props?.readOnly).toBe(true);
  });
});
