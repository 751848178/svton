'use client';

import React, { useMemo, useState } from 'react';
import { AgentProvider, encodeModelKey, useStartupTask } from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import { StartupStateView } from '@svton/agent-ui';
import { BrowserPlatform } from '@svton/agent-platform';
import { initAgentConfig } from '@/lib/agent-setup';
import { createWebModelRegistry, loadWebModelKey } from '@/lib/web-model-registry';
import { createWebModelSwitchHost } from '@/lib/web-model-switch-host';
import {
  injectE2eStartupFailure,
  releaseE2eStartupFailure,
  type E2eStartupFailureSource,
} from '@/lib/e2e-startup-failure';
import { AgentLayout } from './AgentLayout';
import { useI18n } from '@svton/ui';

export default function AgentChat() {
  const { translate: t } = useI18n();
  const [registry] = useState(createWebModelRegistry);
  const [initialModelKey] = useState(() => loadWebModelKey(registry));

  // R4 fix: use useState initializer instead of render-time side effect
  const [platform] = useState(() => new BrowserPlatform());

  const switchHost = useMemo(
    () => initialModelKey
      ? createWebModelSwitchHost(platform, initialModelKey)
      : null,
    [initialModelKey, platform],
  );
  const configKey = useMemo(() => ({
    model: initialModelKey ? encodeModelKey(initialModelKey) : '',
    platform,
  }), [initialModelKey, platform]);
  const configStartup = useStartupTask<AgentConfig>({
    source: 'config',
    generationKey: configKey,
    load: async () => {
      await injectE2eStartupFailure('config');
      if (!initialModelKey) {
        return { kind: 'noConfiguration', cause: t('web.startup.noConfiguration') };
      }
      return {
        kind: 'ready',
        value: await initAgentConfig(encodeModelKey(initialModelKey), platform),
      };
    },
  });
  if (configStartup.state.phase !== 'ready') {
    return (
      <StartupStateView
        state={configStartup.state}
        onRetry={() => {
          releaseE2eStartupFailure('config');
          configStartup.retry();
        }}
        onConfigure={() => { window.location.href = '/settings'; }}
      />
    );
  }
  const config = configStartup.state.value;

  return (
    <AgentProvider
      platform={platform}
      config={config}
      modelKey={initialModelKey ?? undefined}
      beforeStartupSource={injectE2eStartupFailure}
      startupFallback={(startup) => (
        <StartupStateView
          state={startup.state}
          onRetry={() => {
            releaseE2eStartupFailure(startup.state.source as E2eStartupFailureSource);
            startup.retry();
          }}
        />
      )}
    >
      {switchHost && initialModelKey && <AgentLayout
        config={config}
        registry={registry}
        modelSwitchHost={switchHost}
        initialModelKey={initialModelKey}
        browserPlatform={platform}
      />}
    </AgentProvider>
  );
}
