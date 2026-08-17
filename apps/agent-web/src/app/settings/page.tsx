'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SettingsView } from '@svton/agent-ui';
import { BrowserPlatform } from '@svton/agent-platform';
import { initAgentConfig } from '@/lib/agent-setup';
import { BrowserSettingsAdapter } from '@/lib/browser-settings-adapter';
import { encodeModelKey } from '@svton/agent-client';
import { createWebModelRegistry, loadWebModelKey } from '@/lib/web-model-registry';
import { useI18n } from '@svton/ui';
import { createBrowserSettingsPresentationCopy } from '@/lib/locale/web-presentation-copy';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { translate: t } = useI18n();
  const router = useRouter();
  const bootTranslator = useRef(t).current;
  const [platform, setPlatform] = useState<BrowserPlatform | null>(null);
  const [adapter, setAdapter] = useState<BrowserSettingsAdapter | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const nextPlatform = new BrowserPlatform();
    const registry = createWebModelRegistry();
    const nextAdapter = new BrowserSettingsAdapter(
      nextPlatform,
      createBrowserSettingsPresentationCopy(bootTranslator),
      undefined,
      registry,
    );
    setPlatform(nextPlatform);
    setAdapter(nextAdapter);

    const saved = loadWebModelKey(registry);
    initAgentConfig(saved ? encodeModelKey(saved) : undefined, nextPlatform)
      .then((cfg) => {
        nextAdapter.setAgentConfig(cfg);
        setRefreshKey((k) => k + 1);
      })
      .catch((error) => setLoadError(
        error instanceof Error ? error.message : String(error),
      ));
  }, []);

  if (!adapter || !platform) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-500">
        {t('web.settings.loading')}
      </div>
    );
  }

  return (
    <main className="flex min-h-screen w-full bg-black text-gray-100">
      <SettingsView
        adapter={adapter}
        onBack={() => router.push('/')}
        refreshKey={refreshKey}
      />
      {loadError && <div role="alert" className="fixed bottom-4 right-4 text-sm text-red-300">{t('web.settings.failure', { message: loadError })}</div>}
    </main>
  );
}
