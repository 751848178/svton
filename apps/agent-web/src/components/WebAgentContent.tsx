'use client';

import React from 'react';
import type { ReactNode } from 'react';
import type { AgentConfig, SkillScope } from '@svton/agent-core';
import type { View } from './Sidebar';
import { WebAgentsPanel } from './WebAgentsPanel';
import { WebAutomationPanel } from './WebAutomationPanel';
import { WebIntegrationsPanel } from './WebIntegrationsPanel';
import { WebSkillsPanel } from './WebSkillsPanel';

interface WebAgentContentProps {
  view: View;
  config: AgentConfig;
  chat: ReactNode;
  settings: ReactNode;
  tools: Array<{ name: string; description?: string }>;
  skills: Array<{ name: string; description?: string; scope?: SkillScope }>;
}

export function WebAgentContent({
  view,
  config,
  chat,
  settings,
  tools,
  skills,
}: WebAgentContentProps) {
  if (view === 'chat' || view === 'search') return <>{chat}</>;
  if (view === 'automation') return <WebAutomationPanel tools={tools} />;
  if (view === 'skills') return <WebSkillsPanel skills={skills} />;
  if (view === 'agents') return <WebAgentsPanel config={config} />;
  if (view === 'integrations') return <WebIntegrationsPanel config={config} />;
  return <>{settings}</>;
}
