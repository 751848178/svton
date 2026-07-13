'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SettingsView } from '@svton/agent-ui';
import { BrowserPlatform } from '@svton/agent-platform';
import { initAgentConfig } from '@/lib/agent-setup';
import { loadString, LS_DEFAULT_MODEL } from '@/lib/settings-store';
import { BrowserSettingsAdapter } from '@/lib/browser-settings-adapter';

export default function SettingsPage() {
  const [platform, setPlatform] = useState<BrowserPlatform | null>(null);
  const [adapter, setAdapter] = useState<BrowserSettingsAdapter | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const nextPlatform = new BrowserPlatform();
    const nextAdapter = new BrowserSettingsAdapter(nextPlatform);
    setPlatform(nextPlatform);
    setAdapter(nextAdapter);

    const saved = loadString(LS_DEFAULT_MODEL) || undefined;
    // Settings stores "providerId::modelId", extract modelId for initAgentConfig
    const modelId = saved?.includes('::') ? saved.split('::')[1] : saved;
    initAgentConfig(modelId || undefined, nextPlatform)
      .then((cfg) => {
        nextAdapter.setAgentConfig(cfg);
        setRefreshKey((k) => k + 1);
      })
      .catch(() => {});
  }, []);

  if (!adapter || !platform) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-500">
        正在加载设置...
      </div>
    );
  }

  return (
    <main className="flex min-h-screen w-full bg-black text-gray-100">
      <SettingsView
        adapter={adapter}
        onBack={() => { window.location.href = '/'; }}
        refreshKey={refreshKey}
      />
    </main>
  );
}
