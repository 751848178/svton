import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionSettingsControls } from '../src/components/chat/SessionSettingsControls';

describe('SessionSettingsControls status projection', () => {
  it('keeps a later reasoning failure visible after permission success', () => {
    render(<SessionSettingsControls
      execution={{
        value: 'default', phase: 'succeeded',
        message: '执行配置已应用。', select: vi.fn(),
      }}
      reasoning={{
        value: undefined, availableEfforts: ['high'], phase: 'failed',
        message: '推理强度应用失败。', select: vi.fn(),
      }}
    />);

    expect(screen.getByRole('status')).toHaveTextContent('执行配置已应用');
    expect(screen.getByRole('alert')).toHaveTextContent('推理强度应用失败');
  });

  it('does not dispatch a tampered execution-profile value', () => {
    const select = vi.fn();
    render(<SessionSettingsControls
      execution={{ value: 'default', phase: 'idle', select }}
      reasoning={{ value: undefined, availableEfforts: [], phase: 'idle', select: vi.fn() }}
    />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Svton execution profile' }), {
      target: { value: 'tampered' },
    });
    expect(select).not.toHaveBeenCalled();
  });
});
