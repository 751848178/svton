import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModelSelector } from '../src/components/models/ModelSelector';
import type { ModelSelectionControl } from '../src/components/models/model-selection.types';

const active = JSON.stringify({ providerId: 'a', modelId: 'shared' });
const pending = JSON.stringify({ providerId: 'b', modelId: 'shared' });

function control(): ModelSelectionControl {
  return {
    options: [
      {
        value: active,
        modelName: 'Shared',
        providerName: 'Same Name',
        providerId: 'a',
        accessibleName: '(a) Shared — Same Name',
        hiddenCurrent: false,
        removedCurrent: false,
        bootstrap: false,
      },
      {
        value: pending,
        modelName: 'Shared',
        providerName: 'Same Name',
        providerId: 'b',
        accessibleName: '(b) Shared — Same Name',
        hiddenCurrent: false,
        removedCurrent: false,
        bootstrap: false,
      },
    ],
    activeValue: active,
    persistedValue: active,
    pendingValue: pending,
    phase: 'preparing',
    message: '正在准备 Same Name · Shared；当前模型保持不变。',
    activeLabel: 'Same Name · Shared',
    persistedLabel: 'Same Name · Shared',
    canRetryPersistence: false,
    select: vi.fn(),
    retryPersistence: vi.fn(),
    dismissResult: vi.fn(),
  };
}

describe('ModelSelector', () => {
  it('keeps the committed value selected while a candidate prepares', () => {
    render(<ModelSelector control={control()} />);
    expect(screen.getByRole('combobox')).toHaveValue(active);
    expect(screen.getByRole('combobox')).toHaveClass('min-h-11');
    expect(screen.getByRole('status')).toHaveTextContent('当前模型保持不变');
  });

  it('keeps same-named providers separately identifiable by provider id', () => {
    render(<ModelSelector control={control()} variant="settings" />);
    expect(screen.getByRole('group', { name: 'Same Name (a)' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Same Name (b)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '(a) Shared — Same Name' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '(b) Shared — Same Name' })).toBeInTheDocument();
  });

  it('keeps a removed committed identity visible and disabled', () => {
    const removed = {
      ...control(),
      options: [{
        ...control().options[0],
        accessibleName: '(a) Shared A — Provider A',
        removedCurrent: true,
      }, control().options[1]],
    };
    render(<ModelSelector control={removed} />);
    const option = screen.getByRole('option', {
      name: '(a) Shared A — Provider A (removed)',
    });
    expect(screen.getByRole('combobox')).toHaveValue(active);
    expect(option).toBeDisabled();
  });
});
