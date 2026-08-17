import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchIcon } from '@svton/ui';
import { SettingsSwitch } from '@svton/agent-ui';
import type { TauriPlatform } from '@svton/agent-platform';

export interface DesktopSkillDefinition {
  name: string;
  description?: string;
  scope?: string;
}

export function DesktopSkillsPanel({ skills, platform, onManage, onReinit }: {
  skills: DesktopSkillDefinition[];
  platform: TauriPlatform;
  onManage: () => void;
  onReinit?: (workingDir?: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [disabledSkills, setDisabledSkills] = useState<Set<string>>(new Set());
  useEffect(() => {
    void platform.storage.get<string[]>('agent:disabled_skills')
      .then((value) => { if (Array.isArray(value)) setDisabledSkills(new Set(value)); })
      .catch(() => {});
  }, [platform.storage]);
  const toggleSkill = useCallback(async (name: string) => {
    const next = new Set(disabledSkills);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setDisabledSkills(next);
    await platform.storage.set('agent:disabled_skills', Array.from(next));
    onReinit?.();
  }, [disabledSkills, onReinit, platform.storage]);
  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query ? skills.filter((skill) => (
      skill.name.toLowerCase().includes(query) || skill.description?.toLowerCase().includes(query)
    )) : skills;
    return {
      workspace: filtered.filter((skill) => !skill.scope?.includes('plugin')),
      plugins: filtered.filter((skill) => skill.scope?.includes('plugin')),
      count: filtered.length,
    };
  }, [search, skills]);
  return (
    <section aria-labelledby="desktop-skills-heading" className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="desktop-skills-heading" className="text-lg font-light text-white">技能</h2>
        <button onClick={onManage} className="min-h-11 text-[11px] text-cyan-500 hover:text-cyan-400">在设置中管理</button>
      </div>
      <p className="mb-4 text-[11px] text-gray-500">管理项目级与用户级技能。启用后可在聊天里通过 $skill-name 使用。</p>
      <label className="mb-4 flex min-h-11 items-center gap-2 rounded-lg border border-[#383838] bg-[#2a2a2a] px-3">
        <SearchIcon size={14} className="text-gray-500" aria-hidden="true" />
        <span className="sr-only">搜索技能</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索技能..." className="min-w-0 flex-1 bg-transparent text-[12px] text-gray-300 outline-none placeholder:text-gray-600" />
      </label>
      {skills.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">暂无注册的技能</p> : (
        <div className="space-y-6">
          <SkillGroup title="工作区与个人技能" skills={groups.workspace} disabled={disabledSkills} onToggle={toggleSkill} />
          <SkillGroup title="Plugin 技能" skills={groups.plugins} disabled={disabledSkills} onToggle={toggleSkill} plugin />
          {groups.count === 0 && <p className="py-8 text-center text-sm text-gray-600">没有找到匹配的技能</p>}
        </div>
      )}
    </section>
  );
}

function SkillGroup({ title, skills, disabled, onToggle, plugin = false }: {
  title: string;
  skills: DesktopSkillDefinition[];
  disabled: Set<string>;
  onToggle: (name: string) => void;
  plugin?: boolean;
}) {
  if (skills.length === 0) return null;
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">{title}</h3>
      <div className="space-y-2">
        {skills.map((skill) => {
          const enabled = !disabled.has(skill.name);
          return (
            <div key={skill.name} className="flex items-center justify-between gap-3 rounded-lg border border-[#383838] bg-[#2a2a2a] p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={enabled ? 'text-sm font-medium text-white' : 'text-sm font-medium text-gray-600'}>{skill.name}</span>
                  {plugin && <span className="rounded bg-purple-900/30 px-1.5 py-0.5 text-[10px] text-purple-400">Plugin</span>}
                </div>
                {skill.description && <p className="mt-0.5 truncate text-xs text-gray-500">{skill.description}</p>}
              </div>
              <SettingsSwitch checked={enabled} onCheckedChange={() => onToggle(skill.name)} label={skill.name} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
