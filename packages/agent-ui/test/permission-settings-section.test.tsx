import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PermissionSettingsSection } from '../src/components/settings/PermissionSettingsSection';
import { LocaleProvider } from '@svton/ui';
import type { ReactNode } from 'react';

const renderZh = (child: ReactNode) => render(
  <LocaleProvider locale="zh">{child}</LocaleProvider>,
);

describe('PermissionSettingsSection legacy fallback', () => {
  it('waits for persistence before updating local state or showing success', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const setLegacyMode = vi.fn();
    const showToast = vi.fn();
    const showError = vi.fn();
    renderZh(<PermissionSettingsSection
      getPersisted={() => 'auto'}
      savePermissionMode={() => pending}
      legacyMode="default"
      setLegacyMode={setLegacyMode}
      showToast={showToast}
      showError={showError}
    />);

    fireEvent.click(screen.getByRole('button', { name: /全自动/ }));
    expect(setLegacyMode).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();

    await act(async () => { resolve(); await pending; });
    expect(setLegacyMode).toHaveBeenCalledWith('auto');
    expect(showToast).toHaveBeenCalledWith('权限模式已更新');
    expect(showError).not.toHaveBeenCalled();
  });

  it('keeps the prior state and exposes an error when persistence fails', async () => {
    const setLegacyMode = vi.fn();
    const showToast = vi.fn();
    const showError = vi.fn();
    renderZh(<PermissionSettingsSection
      getPersisted={() => 'default'}
      savePermissionMode={async () => { throw new Error('storage unavailable'); }}
      legacyMode="default"
      setLegacyMode={setLegacyMode}
      showToast={showToast}
      showError={showError}
    />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /接受编辑/ }));
    });

    expect(showError).toHaveBeenCalledWith('执行配置保存失败，请重试。');
    expect(setLegacyMode).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('rejects a silent write no-op without a success toast', async () => {
    const setLegacyMode = vi.fn();
    const showToast = vi.fn();
    const showError = vi.fn();
    renderZh(<PermissionSettingsSection
      getPersisted={() => 'default'}
      savePermissionMode={async () => {}}
      legacyMode="default"
      setLegacyMode={setLegacyMode}
      showToast={showToast}
      showError={showError}
    />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /全自动/ }));
    });
    expect(showError).toHaveBeenCalledWith('执行配置保存失败，请重试。');
    expect(setLegacyMode).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
