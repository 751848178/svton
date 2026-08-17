import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator, LocaleProvider, type Locale } from '@svton/ui';
import type { ISettingsAdapter } from '../src/components/settings/settings-adapter.types';
import { AutomationSection } from '../src/components/settings/sections/AutomationSection';
import { MarketplaceSection } from '../src/components/settings/sections/MarketplaceSection';
import { McpMarketplace } from '../src/components/settings/sections/McpMarketplace';
import { MemorySection } from '../src/components/settings/sections/MemorySection';
import { SessionSettingsControls } from '../src/components/chat/SessionSettingsControls';
import { ModelSelector } from '../src/components/models/ModelSelector';

const timestamp = Date.parse('2026-08-04T01:02:03.000Z');

function localized(locale: Locale, child: React.ReactNode) {
  return render(<LocaleProvider locale={locale}>{child}</LocaleProvider>);
}

describe.each(['zh', 'en'] as const)('settings formatter projections (%s)', (locale) => {
  const t = createTranslator(locale);
  it('formats memory and checkpoint timestamps through the active locale', async () => {
    const expected = new Date(timestamp).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en');
    const memory = localized(locale, <MemorySection
      hasMemory memoryText="" memoryInput="" entries={[{
        key: 'memory-1', content: 'Remember this', source: 'test', timestamp,
      }]}
      setMemoryInput={vi.fn()} onAdd={vi.fn()} onClear={vi.fn()} onDeleteEntry={vi.fn()}
    />);
    expect(screen.getByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    memory.unmount();

    const adapter = {
      getHooks: () => [],
      listCheckpoints: async () => [{
        sessionId: 'session-1', messageCount: 2, model: 'gpt-test', updatedAt: timestamp,
      }],
    } as unknown as ISettingsAdapter;
    const automation = localized(locale, <AutomationSection
      hasPlanning hasSubagent tools={[]} adapter={adapter}
    />);
    await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
    expect(screen.getByText(t('settings.checkpoint.messageCount', { count: 2 }))).toBeInTheDocument();
    automation.unmount();
  });

  it('formats marketplace counts through the active locale', async () => {
    const count = 1_234_567;
    const expected = new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en').format(count);
    const adapter = {
      browseMarketplace: async () => ({
        total: 1,
        skills: [{
          id: 'skill-1', name: 'Skill one', source: 'test', installs: count,
          url: 'https://example.test', installed: false,
        }],
      }),
    } as unknown as ISettingsAdapter;
    const marketplace = localized(locale, <MarketplaceSection adapter={adapter} onReload={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(new RegExp(t('settings.marketplace.installCount', { count: expected })))).toBeInTheDocument());
    marketplace.unmount();

    const model = {
      marketQuery: '', setMarketQuery: vi.fn(), marketLoading: false,
      searchMarket: vi.fn(), installingName: null, installMarketServer: vi.fn(),
      marketResults: [{
        id: 'server-1', qualifiedName: 'test/server', displayName: 'Server one',
        description: 'Description', useCount: count, verified: true,
      }],
    } as unknown as React.ComponentProps<typeof McpMarketplace>['model'];
    const mcp = localized(locale, <McpMarketplace model={model} />);
    expect(screen.getByText(t('settings.mcp.installCount', { count: expected }))).toBeInTheDocument();
    mcp.unmount();
  });

  it('selects singular checkpoint and marketplace copy from numeric owner state', async () => {
    const checkpointAdapter = {
      getHooks: () => [],
      listCheckpoints: async () => [{
        sessionId: 'singular-session', messageCount: 1, model: 'gpt-test', updatedAt: timestamp,
      }],
    } as unknown as ISettingsAdapter;
    const automation = localized(locale, <AutomationSection
      hasPlanning hasSubagent tools={[]} adapter={checkpointAdapter}
    />);
    await waitFor(() => expect(screen.getByText(t('settings.checkpoint.messageCountOne'))).toBeInTheDocument());
    automation.unmount();

    const marketplaceAdapter = {
      browseMarketplace: async () => ({
        total: 1,
        skills: [{
          id: 'one', name: 'One install', source: 'test', installs: 1,
          url: 'https://example.test', installed: false,
        }],
      }),
    } as unknown as ISettingsAdapter;
    const marketplace = localized(locale, <MarketplaceSection adapter={marketplaceAdapter} onReload={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(new RegExp(t('settings.marketplace.installCountOne')))).toBeInTheDocument());
    marketplace.unmount();

    const mcpModel = {
      marketQuery: '', setMarketQuery: vi.fn(), marketLoading: false,
      searchMarket: vi.fn(), installingName: null, installMarketServer: vi.fn(),
      marketResults: [{
        id: 'one', qualifiedName: 'test/one', displayName: 'One MCP',
        description: 'Description', useCount: 1, verified: true,
      }],
    } as unknown as React.ComponentProps<typeof McpMarketplace>['model'];
    const mcp = localized(locale, <McpMarketplace model={mcpModel} />);
    expect(screen.getByText(t('settings.mcp.installCountOne'))).toBeInTheDocument();
    mcp.unmount();
  });

  it('projects execution, reasoning, and model controls from the explicit locale', () => {
    const controls = localized(locale, <SessionSettingsControls
      layout="settings"
      execution={{ value: 'default', phase: 'idle', select: vi.fn() }}
      reasoning={{
        value: undefined, availableEfforts: ['high'], defaultEffort: 'high',
        phase: 'idle', select: vi.fn(),
      }}
    />);
    expect(screen.getByRole('combobox', {
      name: locale === 'zh' ? 'Svton 执行配置' : 'Svton execution profile',
    })).toBeInTheDocument();
    expect(screen.getByText(locale === 'zh' ? 'Auto（模型默认：高）' : 'Auto (model default: High)'))
      .toBeInTheDocument();
    controls.unmount();

    const model = localized(locale, <ModelSelector control={{
      options: [{
        value: 'model-1', modelName: 'Model', providerName: 'Provider', providerId: 'provider',
        accessibleName: 'Model — Provider', hiddenCurrent: false, removedCurrent: true,
        bootstrap: false,
      }],
      activeValue: 'model-1', persistedValue: 'model-1', phase: 'idle',
      activeLabel: 'Model — Provider', persistedLabel: 'Model — Provider',
      canRetryPersistence: false, select: vi.fn(), retryPersistence: vi.fn(),
      dismissResult: vi.fn(),
    }} />);
    expect(screen.getByRole('option')).toHaveAccessibleName(
      locale === 'zh' ? 'Model — Provider（已移除）' : 'Model — Provider (removed)',
    );
    model.unmount();
  });
});
