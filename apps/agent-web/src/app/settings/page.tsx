'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SettingsView } from '@svton/agent-ui';
import { BrowserPlatform } from '@svton/agent-platform';
import { initAgentConfig } from '@/lib/agent-setup';
import { loadString, LS_DEFAULT_MODEL } from '@/lib/settings-store';
import { BrowserSettingsAdapter } from '@/lib/browser-settings-adapter';

export default function SettingsPage() {
  // R5 fix: use useState initializer instead of render-time side effect
  const [platform] = useState(() => new BrowserPlatform());
  const [refreshKey, setRefreshKey] = useState(0);
  const [adapter] = useState(() => new BrowserSettingsAdapter(platform));

  useEffect(() => {
    const saved = loadString(LS_DEFAULT_MODEL) || undefined;
    // Settings stores "providerId::modelId", extract modelId for initAgentConfig
    const modelId = saved?.includes('::') ? saved.split('::')[1] : saved;
    initAgentConfig(modelId || undefined, platform)
      .then((cfg) => {
        adapter.setAgentConfig(cfg);
        setRefreshKey((k) => k + 1);
      })
      .catch(() => {});
  }, [adapter, platform]);

  return (
    <SettingsView
      adapter={adapter}
      onBack={() => { window.location.href = '/'; }}
      refreshKey={refreshKey}
    />
  );
}
