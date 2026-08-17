import React from 'react';
import type { ReactNode } from 'react';
import type { View } from '@/components/Sidebar';

interface DesktopMainContentProps {
  view: View;
  chat: ReactNode;
  automation: ReactNode;
  skills: ReactNode;
  plugins: ReactNode;
  agents: ReactNode;
  worktrees: ReactNode;
  integrations: ReactNode;
  chronicle: ReactNode;
}

export function DesktopMainContent(props: DesktopMainContentProps) {
  if (props.view === 'chat' || props.view === 'search') return <>{props.chat}</>;
  if (props.view === 'automation') return <>{props.automation}</>;
  if (props.view === 'skills') return <>{props.skills}</>;
  if (props.view === 'plugins') return <>{props.plugins}</>;
  if (props.view === 'agents') return <>{props.agents}</>;
  if (props.view === 'worktrees') return <>{props.worktrees}</>;
  if (props.view === 'integrations') return <>{props.integrations}</>;
  return <>{props.chronicle}</>;
}
