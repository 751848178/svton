import React from 'react';

interface PluginInfo { name: string; enabled: boolean }
interface ProjectInfo { id: string; name: string }

interface InputControlsProps {
  sessionSettings: React.ReactNode;
  plugins: PluginInfo[];
  onPluginToggle: (name: string, enabled: boolean) => void;
  gitBranch?: string | null;
  projectName?: string | null;
  projects?: ProjectInfo[];
  currentProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
}

/** Host-only composer controls; execution and reasoning are shared presenters. */
export function InputControls({
  sessionSettings,
  plugins,
  onPluginToggle,
  gitBranch,
  projectName,
  projects,
  currentProjectId,
  onSelectProject,
}: InputControlsProps) {
  return (
    <>
      <div className="h-4 w-px flex-shrink-0 bg-[#333]" />
      {sessionSettings}
      {projects && projects.length > 0 && (
        <label className="flex-shrink-0">
          <span className="sr-only">项目</span>
          <select
            aria-label="项目"
            value={currentProjectId ?? ''}
            onChange={(event) => onSelectProject?.(event.target.value || null)}
            className="min-h-11 max-w-[150px] rounded-md border border-[#383838] bg-[#1c1c1c] px-3 text-xs text-gray-300"
          >
            <option value="">Chat 模式</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
      )}
      {plugins.length > 0 && (
        <details className="relative flex-shrink-0">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md px-3 text-xs text-gray-500 hover:bg-[#2a2a2a]/60 hover:text-gray-300">
            插件
          </summary>
          <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-lg border border-[#383838] bg-[#2a2a2a] py-1 shadow-xl">
            {plugins.map((plugin) => (
              <label key={plugin.name} className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs text-gray-400 hover:bg-[#252525]">
                <input
                  type="checkbox"
                  checked={plugin.enabled}
                  onChange={(event) => onPluginToggle(plugin.name, event.target.checked)}
                />
                {plugin.name}
              </label>
            ))}
          </div>
        </details>
      )}
      {!projects && (projectName || gitBranch) && (
        <div className="flex flex-shrink-0 items-center gap-2 text-[10px] text-gray-600">
          {projectName && <span className="max-w-[100px] truncate">{projectName}</span>}
          {gitBranch && <span>{gitBranch}</span>}
        </div>
      )}
      <div className="min-w-2 flex-1" />
    </>
  );
}
