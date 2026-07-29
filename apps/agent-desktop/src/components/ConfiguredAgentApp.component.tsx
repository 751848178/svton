import { AgentProvider } from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import type { AgentExtra } from '@/lib/agent-setup';
import { desktopE2eActive } from '@/lib/e2e-provider';
import { DesktopE2eAutoDrive } from './DesktopE2eAutoDrive';
import { MainLayout } from './MainLayout';

interface ConfiguredAgentAppProps {
  platform: TauriPlatform;
  config: AgentConfig;
  initialSessionId?: string;
  models: { id: string; name: string; providerName: string }[];
  currentModel: string;
  setCurrentModel: (model: string) => void;
  onReinit: (workingDir?: string) => Promise<void>;
  extra?: AgentExtra;
}

export function ConfiguredAgentApp({
  platform,
  config,
  initialSessionId,
  models,
  currentModel,
  setCurrentModel,
  onReinit,
  extra,
}: ConfiguredAgentAppProps) {
  return (
    <AgentProvider
      platform={platform}
      config={config}
      initialSessionId={initialSessionId}
    >
      {desktopE2eActive() ? <DesktopE2eAutoDrive /> : null}
      <MainLayout
        config={config}
        platform={platform}
        models={models}
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        onReinit={onReinit}
        extra={extra}
      />
    </AgentProvider>
  );
}
