import { AgentProvider } from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import { StartupStateView } from '@svton/agent-ui';
import type { AgentExtra } from '@/lib/agent-setup';
import { desktopE2eActive } from '@/lib/e2e-provider';
import { DesktopE2eAutoDrive } from './DesktopE2eAutoDrive';
import { MainLayout } from './MainLayout';
import { useMemo } from 'react';
import type { LiveModelRegistry } from '@svton/agent-app';
import type { ModelKey } from '@svton/agent-client';
import { createDesktopModelSwitchHost } from '@/lib/desktop-model-switch-host';

interface ConfiguredAgentAppProps {
  platform: TauriPlatform;
  config: AgentConfig;
  initialSessionId?: string;
  registry: LiveModelRegistry;
  initialModelKey: ModelKey;
  onReinit: (workingDir?: string) => Promise<void>;
  extra?: AgentExtra;
}

export function ConfiguredAgentApp({
  platform,
  config,
  initialSessionId,
  registry,
  initialModelKey,
  onReinit,
  extra,
}: ConfiguredAgentAppProps) {
  const modelSwitchHost = useMemo(
    () => createDesktopModelSwitchHost(platform, initialModelKey),
    [initialModelKey, platform],
  );
  return (
    <AgentProvider
      platform={platform}
      config={config}
      modelKey={initialModelKey}
      initialSessionId={initialSessionId}
      startupFallback={(startup) => (
        <StartupStateView state={startup.state} onRetry={startup.retry} />
      )}
    >
      {desktopE2eActive() ? <DesktopE2eAutoDrive /> : null}
      <MainLayout
        config={config}
        platform={platform}
        registry={registry}
        modelSwitchHost={modelSwitchHost}
        initialModelKey={initialModelKey}
        onReinit={onReinit}
        extra={extra}
      />
    </AgentProvider>
  );
}
