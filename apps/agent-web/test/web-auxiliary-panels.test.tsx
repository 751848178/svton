import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from '@svton/agent-core';
import { LocaleProvider, type Locale } from '@svton/ui';
import { WebAgentsPanel } from '../src/components/WebAgentsPanel';
import { WebAutomationPanel } from '../src/components/WebAutomationPanel';
import { WebIntegrationsPanel } from '../src/components/WebIntegrationsPanel';
import { WebSkillsPanel } from '../src/components/WebSkillsPanel';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) =>
    <a href={href} {...props}>{children}</a>,
}));

function localized(locale: Locale, child: React.ReactNode) {
  return renderToStaticMarkup(<LocaleProvider locale={locale}>{child}</LocaleProvider>);
}

describe.each([
  ['en', 'Automation', 'Skills', 'Custom Agents', 'Integrations', 'Open settings', 'Enabled', 'Disabled', '1 tool is currently registered.', '2 tools are currently registered.'],
  ['zh', '自动化任务', '技能', '自定义 Agents', '集成', '前往设置', '已启用', '未启用', '当前已注册 1 个工具。', '当前已注册 2 个工具。'],
] as const)('Web auxiliary locale (%s)', (
  locale, automation, skills, agents, integrations, settings, enabled, disabled, oneTool, twoTools,
) => {
  it('renders all four independent panels from explicit locale context', () => {
    const automationHtml = localized(locale, <WebAutomationPanel tools={[{ name: 'tool-1' }]} />);
    expect(automationHtml).toContain(`>${automation}<`);
    expect(automationHtml).toContain(`>${oneTool}<`);
    expect(localized(locale, <WebAutomationPanel tools={[{ name: 'one' }, { name: 'two' }]} />))
      .toContain(`>${twoTools}<`);

    const skillsHtml = localized(locale, <WebSkillsPanel skills={[]} />);
    expect(skillsHtml).toContain(`>${skills}<`);
    expect(skillsHtml).toContain('href="/settings"');
    expect(skillsHtml).toContain(locale === 'zh' ? '暂无注册的技能' : 'No skills are registered');

    const config = { capabilities: {} } as AgentConfig;
    const agentsHtml = localized(locale, <WebAgentsPanel config={config} />);
    expect(agentsHtml).toContain(`>${agents}<`);

    const integrationsHtml = localized(locale, <WebIntegrationsPanel config={config} />);
    expect(integrationsHtml).toContain(`>${integrations}<`);
    expect(integrationsHtml).toContain(`>${settings}<`);
    expect(integrationsHtml).toContain('href="/settings"');
  });

  it('renders bounded populated and enabled/disabled manager states', () => {
    const skillsHtml = localized(locale, <WebSkillsPanel skills={[
      { name: 'project-skill', description: 'Project description bytes', scope: 'project' },
      { name: 'user-skill', description: 'User description bytes', scope: 'user' },
      { name: 'admin-skill', description: 'Admin description bytes', scope: 'admin' },
      { name: 'system-skill', description: 'System description bytes', scope: 'system' },
    ]} />);
    for (const value of ['project-skill', 'user-skill', 'admin-skill', 'system-skill',
      'Project description bytes', 'User description bytes',
      'Admin description bytes', 'System description bytes']) {
      expect(skillsHtml).toContain(value);
    }
    const expectedScopes = locale === 'zh'
      ? ['项目', '用户', '管理员', '系统']
      : ['Project', 'User', 'Admin', 'System'];
    for (const scope of expectedScopes) expect(skillsHtml).toContain(`>${scope}<`);
    expect(skillsHtml).not.toContain(locale === 'zh' ? '>project<' : '>项目<');

    const config = {
      capabilities: {
        agentDefinitionManager: { list: () => [
          { name: 'reviewer', title: 'Reviewer', description: 'Reviews changes', model: 'e2e-model' },
        ] },
        integrationManager: { list: () => [
          { id: 'on', name: 'Enabled fixture', enabled: true },
          { id: 'off', name: 'Disabled fixture', enabled: false },
        ] },
      },
    } as unknown as AgentConfig;
    const agentsHtml = localized(locale, <WebAgentsPanel config={config} />);
    expect(agentsHtml).toContain('Reviewer');
    expect(agentsHtml).toContain('e2e-model');
    const integrationsHtml = localized(locale, <WebIntegrationsPanel config={config} />);
    expect(integrationsHtml).toContain('Enabled fixture');
    expect(integrationsHtml).toContain('Disabled fixture');
    expect(integrationsHtml).toContain(`>${enabled}<`);
    expect(integrationsHtml).toContain(`>${disabled}<`);
  });
});

describe('static/basePath navigation contract', () => {
  it('keeps settings navigation owned by Next Link and the production basePath config', () => {
    const root = resolve(process.cwd(), '../..');
    const nextConfig = readFileSync(resolve(root, 'apps/agent-web/next.config.js'), 'utf8');
    expect(nextConfig).toContain("basePath: isProd ? '/svton/demo' : ''");
    for (const file of ['WebSkillsPanel.tsx', 'WebIntegrationsPanel.tsx']) {
      const source = readFileSync(resolve(root, `apps/agent-web/src/components/${file}`), 'utf8');
      expect(source, file).toContain("import Link from 'next/link'");
      expect(source, file).toContain('href="/settings"');
      expect(source, file).not.toMatch(/window\.location|location\.href/);
    }
    const settingsPage = readFileSync(resolve(root, 'apps/agent-web/src/app/settings/page.tsx'), 'utf8');
    expect(settingsPage).toContain("import { useRouter } from 'next/navigation'");
    expect(settingsPage).toContain("onBack={() => router.push('/')}");
    expect(settingsPage).not.toMatch(/window\.location|location\.href/);
  });
});
