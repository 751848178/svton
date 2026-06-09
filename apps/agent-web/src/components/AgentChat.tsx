'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AgentProvider } from '@svton/agent-client';
import type { AgentConfig } from '@svton/agent-core';
import { BrowserPlatform } from '@svton/agent-platform';
import { initAgentConfig } from '@/lib/agent-setup';
import { loadSettings } from '@/lib/settings-store';
import { AgentLayout } from './AgentLayout';

export default function AgentChat() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [currentModel, setCurrentModel] = useState('');
  const [models, setModels] = useState<{ id: string; name: string; providerName: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // R4 fix: use useState initializer instead of render-time side effect
  const [platform] = useState(() => new BrowserPlatform());

  // Load models from providers
  useEffect(() => {
    const settings = loadSettings();
    const allModels = settings.flatMap((p) =>
      p.models.map((m) => ({ ...m, providerId: p.id, providerName: p.name })),
    );
    setModels(allModels);
    if (!currentModel) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('agent-web:defaultModel') : null;
      const defaultModel = saved && allModels.some(m => m.id === saved) ? saved : allModels[0]?.id;
      if (defaultModel) setCurrentModel(defaultModel);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Init agent when model changes
  useEffect(() => {
    if (!currentModel) return;
    localStorage.setItem('agent-web:defaultModel', currentModel);
    let cancelled = false;
    initAgentConfig(currentModel, platform)
      .then((cfg) => { if (!cancelled) setConfig(cfg); })
      .catch((e) => console.error(e));
    return () => { cancelled = true; };
  }, [currentModel, platform]);

  if (!config) {
    if (!currentModel) {
      return (
        <div className="flex items-center justify-center h-screen bg-black">
          <div className="text-center">
            <p className="text-gray-500 mb-4 text-sm">请先配置 API Key 以开始使用</p>
            <a href="/settings" className="px-5 py-2 text-sm font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors">
              打开设置
            </a>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="w-full max-w-md mx-auto px-4 space-y-4">
          <div className="h-8 bg-[#222] rounded-lg animate-pulse w-3/4" />
          <div className="h-4 bg-[#222] rounded animate-pulse w-1/2" />
          <div className="h-32 bg-[#222] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <AgentProvider platform={platform} config={config}>
      <AgentLayout
        config={config}
        models={models}
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        dropdownOpen={dropdownOpen}
        setDropdownOpen={setDropdownOpen}
        dropRef={dropRef}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
    </AgentProvider>
  );
}
