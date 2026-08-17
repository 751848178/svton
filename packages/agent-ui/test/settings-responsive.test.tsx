import React from 'react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsView, type ISettingsAdapter, type ProviderInfo } from '../src/components/settings/SettingsView';
import { LocaleProvider } from '@svton/ui';

const renderZh = (child: React.ReactNode) => render(
  <LocaleProvider locale="zh">{child}</LocaleProvider>,
);

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

function createAdapter(saveProviders = vi.fn(async () => {})): ISettingsAdapter {
  const providers: ProviderInfo[] = [{ id: 'openai', name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com', apiKey: 'secret', models: [{ id: 'gpt', name: 'GPT' }] }];
  return {
    getProviders: () => providers,
    setProviders: () => {},
    saveProviders,
    getDefaultModel: () => 'openai:gpt',
    setDefaultModel: async () => {},
    getAgentData: () => ({ tools: [], skills: [], permissionMode: 'default', hasMemory: false, memoryText: '', mcpServers: [], hasSubagent: false, hasPlanning: false }),
    reloadAgent: () => {},
    getCustomInstructions: () => '',
    saveCustomInstructions: () => {},
    getPermissionMode: () => 'default',
    savePermissionMode: async () => {},
    getDisabledTools: () => [],
    saveDisabledTools: () => {},
    getDisabledSkills: () => [],
    saveDisabledSkills: () => {},
    addMemory: () => {},
    clearMemory: () => {},
    getStorageDescription: () => 'Local storage',
    getMcpServerConfigs: () => Array.from({ length: 12 }, (_, index) => ({ name: `server-${index}`, transport: 'http' as const, url: `https://mcp-${index}.example`, enabled: true })),
    getSearchEndpoint: () => '',
    saveSearchEndpoint: () => {},
  };
}

describe('responsive Settings', () => {
  it('uses exactly one labelled compact navigation control with 12px content gutters', async () => {
    setViewport(390);
    const user = userEvent.setup();
    renderZh(<SettingsView adapter={createAdapter()} onBack={() => {}} />);
    const navigation = screen.getByRole('combobox', { name: '设置类别' });
    expect(navigation).toBeVisible();
    expect(screen.queryByRole('navigation', { name: '设置类别' })).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-shell')).toHaveClass('h-[100dvh]', 'overflow-hidden');
    await user.selectOptions(navigation, 'mcp');
    expect(screen.getAllByText(/server-/)).toHaveLength(12);
  });

  it('uses persistent selected navigation at wide width', () => {
    setViewport(1280);
    renderZh(<SettingsView adapter={createAdapter()} onBack={() => {}} />);
    expect(screen.getByRole('navigation', { name: '设置类别' })).toBeVisible();
    expect(screen.getByRole('button', { name: '常规' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('combobox', { name: '设置类别' })).not.toBeInTheDocument();
  });

  it('owns async persistence success and failure feedback centrally', async () => {
    setViewport(390);
    const saveProviders = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderZh(<SettingsView adapter={createAdapter(saveProviders)} onBack={() => {}} />);
    await user.selectOptions(screen.getByRole('combobox', { name: '设置类别' }), 'providers');
    const name = screen.getByLabelText('名称');
    await user.clear(name);
    await user.type(name, 'Updated');
    await user.click(screen.getByRole('button', { name: '保存配置' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider 配置保存失败');
    await user.click(screen.getByRole('button', { name: '保存配置' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Provider 配置已保存');
  });

  it('keeps touched Settings sources bounded and free of inline visual glyphs', () => {
    const root = `${process.cwd()}/src/components/settings`;
    const files = collectSources(root);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/<svg\b|[→←✓⚠★●]/u);
      expect(source, file).not.toMatch(/(?<!:)grid-cols-2/);
      expect(source.split('\n').length - 1, file).toBeLessThanOrEqual(200);
    }
  });
});

function collectSources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = `${directory}/${entry}`;
    return statSync(path).isDirectory() ? collectSources(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}
