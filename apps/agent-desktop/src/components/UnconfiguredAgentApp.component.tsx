import type { Dispatch, SetStateAction } from 'react';
import type { TauriPlatform } from '@svton/agent-platform';
import { ChatPanel, type ChatPanelMessage } from '@svton/agent-ui';
import { Sidebar, type View } from './Sidebar';
import { SettingsPanel } from './SettingsPanel';
import { startDragging, toggleMaximize } from '@/lib/window-controls';

const unavailableManagement = {
  rename: async () => ({ ok: false as const, reason: 'invalid' as const }),
  setPinned: async () => ({ ok: false as const, reason: 'invalid' as const }),
  archive: async () => ({ ok: false as const, reason: 'invalid' as const }),
  stopAndArchive: async () => ({ ok: false as const, reason: 'invalid' as const }),
  unarchive: async () => ({ ok: false as const, reason: 'invalid' as const }),
  deletePermanently: async () => {},
};

const emptySearch = {
  query: '', scope: 'active' as const, includeContent: false,
  searching: false, error: null,
  setQuery: () => {}, setScope: () => {}, setIncludeContent: () => {}, retry: () => {},
};

interface UnconfiguredAgentAppProps {
  platform: TauriPlatform | null;
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  messages: ChatPanelMessage[];
  onSend: (content: string) => Promise<void>;
  onEditConfig: () => Promise<void>;
  unconfigured: boolean;
}

export function UnconfiguredAgentApp({
  platform,
  view,
  setView,
  messages,
  onSend,
  onEditConfig,
  unconfigured,
}: UnconfiguredAgentAppProps) {
  if (view === 'settings' && platform) {
    return (
      <div className="flex flex-col h-screen bg-[#212121] text-gray-100">
        <div
          onMouseDown={() => startDragging()}
          onDoubleClick={() => toggleMaximize()}
          className="h-9 flex-shrink-0 cursor-default select-none"
        />
        <SettingsPanel platform={platform} onBack={() => setView('chat')} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#212121] text-gray-100">
      {platform && (
        <Sidebar
          config={null}
          activeSessions={[]}
          searchResults={[]}
          sessionSearch={emptySearch}
          activityBySessionId={new Map()}
          managementBySessionId={new Map()}
          managementActions={unavailableManagement}
          currentSessionId={null}
          projects={[]}
          currentProjectId={null}
          onNewChat={() => {}}
          onSwitchSession={() => {}}
          onNavigate={setView}
          onSwitchProject={() => {}}
          onOpenProjectFolder={() => {}}
          onDeleteProject={() => {}}
          activeView={view}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        {(view === 'chat' || view === 'search') && (
          <ChatPanel
            messages={messages}
            onSend={onSend}
            disabled={false}
            placeholder="Press Cmd+, to configure..."
            emptyMessage={unconfigured ? (
              <div className="text-center py-8">
                <h2 className="text-2xl text-white font-light tracking-tight mb-2">
                  Welcome to Svton
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  按 Cmd+, 打开配置文件，填入 API Key 即可开始
                </p>
                <button
                  onClick={() => { void onEditConfig(); }}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
                >
                  打开配置文件
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">Loading...</p>
              </div>
            )}
            presets={[]}
            className="bg-transparent"
          />
        )}
        {(view === 'automation' || view === 'skills') && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-lg text-white font-light mb-2">
                {view === 'automation' ? '自动化' : '技能'}
              </h2>
              <p className="text-sm text-gray-500">请先完成配置后使用</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
