import { SettingsView, type ISettingsAdapter } from '@svton/agent-ui';

interface AgentShellSettingsProps {
  title: string;
  adapter: ISettingsAdapter;
  onBack: () => void;
}

export function AgentShellSettings({
  title,
  adapter,
  onBack,
}: AgentShellSettingsProps) {
  return (
    <div className="flex flex-col h-screen bg-[#000000] text-gray-100 font-mono">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#222]">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-[12px]">
          ← 返回
        </button>
        <span className="text-sm text-gray-300">{title} — 设置</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <SettingsView adapter={adapter} onBack={onBack} />
      </div>
    </div>
  );
}
