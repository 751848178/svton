import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  AgentConfig,
  WorktreeManager,
  ChronicleManager,
  AutomationManager,
  IntegrationManager,
} from '@svton/agent-core';
import {
  IntegrationsPanel,
  AgentPicker,
  AgentEditorPanel,
  type IntegrationCardData,
  type AgentDefinitionOption,
} from '@svton/agent-ui';

// ════════════════════════════════════════════════════════════
// AutomationPanel — manage scheduled/triggered automations
// ════════════════════════════════════════════════════════════

export function AutomationPanelExtra({ automationManager, onManage }: {
  automationManager?: AutomationManager;
  onManage?: () => void;
}) {
  const [automations, setAutomations] = useState<any[]>([]);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newInterval, setNewInterval] = useState('30');
  const [triggerType, setTriggerType] = useState<'interval' | 'cron' | 'event'>('interval');
  const [newCron, setNewCron] = useState('0 9 * * *');
  const [newEvent, setNewEvent] = useState('file_save');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setAutomations(automationManager?.list() ?? []);
    automationManager?.getRecentRuns(10).then(setRecentRuns).catch(() => {});
  }, [automationManager]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    if (!automationManager || !newName.trim() || !newPrompt.trim()) return;
    setError(null);
    try {
      let trigger: any;
      if (triggerType === 'interval') {
        trigger = { type: 'interval', minutes: Math.max(1, parseInt(newInterval, 10) || 30) };
      } else if (triggerType === 'cron') {
        trigger = { type: 'cron', expression: newCron.trim() };
      } else {
        trigger = { type: 'event', eventType: newEvent.trim() };
      }
      await automationManager.create({
        name: newName.trim(),
        description: '',
        trigger,
        prompt: newPrompt.trim(),
      });
      setNewName(''); setNewPrompt(''); setNewInterval('30'); setNewCron('0 9 * * *'); setTriggerType('interval');
      setCreating(false);
      refresh();
    } catch (e: any) {
      setError(e?.message ?? '创建失败');
    }
  }, [automationManager, newName, newPrompt, newInterval, newCron, newEvent, triggerType, refresh]);

  const handlePause = useCallback(async (id: string) => {
    await automationManager?.pause(id);
    refresh();
  }, [automationManager, refresh]);

  const handleResume = useCallback(async (id: string) => {
    await automationManager?.resume(id);
    refresh();
  }, [automationManager, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    await automationManager?.delete(id);
    refresh();
  }, [automationManager, refresh]);

  const handleRunNow = useCallback(async (id: string) => {
    await automationManager?.runNow(id);
    refresh();
  }, [automationManager, refresh]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg text-white font-light">自动化任务</h2>
        <div className="flex items-center gap-2">
          {onManage && <button onClick={onManage} className="text-[11px] text-cyan-500 hover:text-cyan-400">在设置中管理 →</button>}
          {automationManager && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-1 text-[11px] font-medium rounded-lg border border-[#333] text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            >
              + 新建
            </button>
          )}
        </div>
      </div>

      {!automationManager ? (
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">自动化管理器未初始化</p>
        </div>
      ) : (
        <>
          {creating && (
            <div className="mb-4 bg-[#2a2a2a] border border-cyan-900/50 rounded-lg p-4 space-y-3">
              <div className="text-sm text-cyan-400 font-medium">创建自动化任务</div>
              {error && <div className="text-[11px] text-red-400">{error}</div>}
              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">名称</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="每日报表"
                  className="w-full px-3 py-2 text-sm bg-[#2a2a2a] border border-[#333] rounded-lg text-gray-200 outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">提示词</label>
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Agent 执行的提示词..."
                  className="w-full px-3 py-2 text-sm bg-[#2a2a2a] border border-[#333] rounded-lg text-gray-200 outline-none focus:border-cyan-600 resize-none h-20"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">触发方式</label>
                <div className="flex gap-2">
                  {(['interval', 'cron', 'event'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTriggerType(t)}
                      className={`px-3 py-1 text-[11px] rounded-md transition-colors ${triggerType === t ? 'bg-cyan-600 text-white' : 'bg-[#2a2a2a] text-gray-400 hover:text-gray-200'}`}
                    >
                      {t === 'interval' ? '定时' : t === 'cron' ? 'Cron' : '事件'}
                    </button>
                  ))}
                </div>
              </div>
              {triggerType === 'interval' && (
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">间隔（分钟）</label>
                  <input type="number" value={newInterval} onChange={(e) => setNewInterval(e.target.value)} min={1}
                    className="w-24 px-3 py-2 text-sm bg-[#2a2a2a] border border-[#333] rounded-lg text-gray-200 outline-none focus:border-cyan-600" />
                </div>
              )}
              {triggerType === 'cron' && (
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">Cron 表达式 <span className="text-gray-600 normal-case">(分 时 日 月 周)</span></label>
                  <input type="text" value={newCron} onChange={(e) => setNewCron(e.target.value)} placeholder="0 9 * * *"
                    className="w-48 px-3 py-2 text-sm bg-[#2a2a2a] border border-[#333] rounded-lg text-gray-200 outline-none focus:border-cyan-600 font-mono" />
                  <p className="text-[10px] text-gray-600 mt-1">例: <code>0 9 * * *</code> = 每天 9:00, <code>*/30 * * * *</code> = 每 30 分钟</p>
                </div>
              )}
              {triggerType === 'event' && (
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">事件类型</label>
                  <input type="text" value={newEvent} onChange={(e) => setNewEvent(e.target.value)} placeholder="file_save"
                    className="w-48 px-3 py-2 text-sm bg-[#2a2a2a] border border-[#333] rounded-lg text-gray-200 outline-none focus:border-cyan-600" />
                  <p className="text-[10px] text-gray-600 mt-1">事件触发型任务需外部调用 runNow()</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || !newPrompt.trim()}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  创建
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(''); setNewPrompt(''); setNewInterval('30'); setNewCron('0 9 * * *'); setTriggerType('interval'); setError(null); }}
                  className="px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {automations.length === 0 && !creating ? (
            <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-8 text-center">
              <p className="text-gray-400 text-sm mb-1">暂无自动化任务</p>
              <p className="text-gray-600 text-xs">点击「+ 新建」创建定时或事件触发的自动化任务</p>
            </div>
          ) : (
            <div className="space-y-2">
              {automations.map((a: any) => (
                <div key={a.id} className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${a.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                      <span className="text-sm text-white font-medium">{a.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] text-gray-500">
                        {a.trigger?.type === 'interval' ? `每 ${a.trigger.minutes} 分钟` :
                         a.trigger?.type === 'cron' ? `cron: ${a.trigger.expression}` :
                         a.trigger?.type === 'event' ? `事件: ${a.trigger.eventType ?? ''}` : '未知'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleRunNow(a.id)} className="text-[10px] text-cyan-400 hover:text-cyan-300">立即运行</button>
                      {a.enabled ? (
                        <button onClick={() => handlePause(a.id)} className="text-[10px] text-gray-400 hover:text-yellow-400">暂停</button>
                      ) : (
                        <button onClick={() => handleResume(a.id)} className="text-[10px] text-gray-400 hover:text-green-400">恢复</button>
                      )}
                      <button onClick={() => handleDelete(a.id)} className="text-[10px] text-gray-400 hover:text-red-400">删除</button>
                    </div>
                  </div>
                  {a.prompt && <div className="text-xs text-gray-500 mt-1 truncate">{a.prompt}</div>}
                  <div className="text-[10px] text-gray-600 mt-1 flex gap-3">
                    {a.lastRunAt && <span>上次: {new Date(a.lastRunAt).toLocaleString()}</span>}
                    {a.nextRunAt && a.nextRunAt > 0 && <span>下次: {new Date(a.nextRunAt).toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Execution History / Inbox */}
      {recentRuns.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[13px] text-gray-400 font-medium mb-2">执行历史</h3>
          <div className="space-y-1">
            {recentRuns.map((run: any) => (
              <div key={run.id} className="flex items-center gap-2 px-3 py-1.5 bg-[#252525] border border-[#333] rounded-md">
                <span className={`text-[10px] flex-shrink-0 ${run.status === 'completed' ? 'text-green-400' : run.status === 'failed' ? 'text-red-400' : 'text-blue-400 animate-pulse'}`}>
                  {run.status === 'completed' ? '✓' : run.status === 'failed' ? '✗' : '●'}
                </span>
                <span className="text-[11px] text-gray-300 truncate flex-1">{run.automationName || run.automationId}</span>
                <span className="text-[10px] text-gray-600 flex-shrink-0">{new Date(run.startedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// ════════════════════════════════════════════════════════════

export function WorktreePanelExtra({ worktreeManager, workingDir, onManage }: {
  worktreeManager?: WorktreeManager;
  workingDir: string;
  onManage?: () => void;
}) {
  const [worktrees, setWorktrees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [branchName, setBranchName] = useState('');

  const refresh = useCallback(async () => {
    if (!worktreeManager) return;
    setLoading(true);
    setError(null);
    try {
      const list = await worktreeManager.list(workingDir);
      setWorktrees(list);
    } catch (e: any) {
      setError(e?.message ?? '加载工作树失败');
      setWorktrees([]);
    } finally {
      setLoading(false);
    }
  }, [worktreeManager, workingDir]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    if (!worktreeManager || !branchName.trim()) return;
    setError(null);
    try {
      await worktreeManager.create(workingDir, { branch: branchName.trim() });
      setBranchName('');
      setCreating(false);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? '创建工作树失败');
    }
  }, [worktreeManager, workingDir, branchName, refresh]);

  const handleRemove = useCallback(async (path: string) => {
    if (!worktreeManager) return;
    setError(null);
    try {
      await worktreeManager.remove(workingDir, path);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? '删除工作树失败');
    }
  }, [worktreeManager, workingDir, refresh]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg text-white font-light">Git 工作树</h2>
        <div className="flex items-center gap-2">
          {onManage && <button onClick={onManage} className="text-[11px] text-cyan-500 hover:text-cyan-400">在设置中管理 →</button>}
          {worktreeManager && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-1 text-[11px] font-medium rounded-lg border border-[#333] text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            >
              + 创建工作树
            </button>
          )}
        </div>
      </div>

      {!worktreeManager ? (
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">Worktree 管理器未初始化</p>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-3 text-[11px] text-red-400 px-3 py-2 rounded-lg bg-red-900/20">{error}</div>
          )}

          {creating && (
            <div className="mb-4 bg-[#2a2a2a] border border-cyan-900/50 rounded-lg p-4 space-y-3">
              <div className="text-sm text-cyan-400 font-medium">创建工作树</div>
              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wider block mb-1">分支名称</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="feature-branch"
                  className="w-full px-3 py-2 text-sm bg-[#2a2a2a] border border-[#333] rounded-lg text-gray-200 outline-none focus:border-cyan-600"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!branchName.trim()}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  创建
                </button>
                <button
                  onClick={() => { setCreating(false); setBranchName(''); }}
                  className="px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-8 text-center">
              <p className="text-gray-500 text-sm">加载中...</p>
            </div>
          ) : worktrees.length === 0 ? (
            <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-8 text-center">
              <p className="text-gray-400 text-sm mb-1">暂无工作树</p>
              <p className="text-gray-600 text-xs">工作目录可能不是 Git 仓库</p>
            </div>
          ) : (
            <div className="space-y-2">
              {worktrees.map((w: any) => (
                <div key={w.path} className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${w.locked ? 'bg-yellow-500' : 'bg-green-500'}`} />
                      <span className="text-sm text-white font-medium truncate">{w.branch || '(detached)'}</span>
                      {w.locked && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-400">locked</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemove(w.path)}
                      className="text-[10px] text-gray-400 hover:text-red-400 flex-shrink-0 ml-2"
                    >
                      删除
                    </button>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1 truncate font-mono">{w.path}</div>
                  {w.head && <div className="text-[10px] text-gray-600 mt-0.5 font-mono">HEAD: {w.head.slice(0, 8)}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// AgentsPanel — agent definition picker + editor
// ════════════════════════════════════════════════════════════

export function AgentsPanelExtra({ config, onManage, onSwitchAgent }: {
  config: AgentConfig;
  onManage?: () => void;
  onSwitchAgent?: (name: string) => void;
}) {
  const agentDefinitionManager = config.capabilities?.agentDefinitionManager;
  const [agents, setAgents] = useState<any[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!agentDefinitionManager) return;
    setAgents(agentDefinitionManager.list());
  }, [agentDefinitionManager, refreshKey]);

  const pickerOptions: AgentDefinitionOption[] = useMemo(() =>
    agents.map((a) => ({
      name: a.name,
      title: a.title ?? a.name,
      description: a.description ?? '',
      icon: a.icon,
      color: a.color,
    })),
  [agents]);

  const handleSelect = useCallback((name: string) => {
    setActiveAgent(name ? name : null);
    // Actually switch the agent via runtime by sending /agent command
    // The runtime intercepts /agent <name> and applies the definition
    if (name && onSwitchAgent) {
      onSwitchAgent(name);
    }
  }, [onSwitchAgent]);

  const handleSave = useCallback(async (agent: any) => {
    if (!agentDefinitionManager) return;
    await agentDefinitionManager.save({
      name: agent.name,
      title: agent.title ?? '',
      description: agent.description ?? '',
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools,
      permissions: agent.permissions,
      color: agent.color,
      source: 'user',
    });
    setRefreshKey((k) => k + 1);
  }, [agentDefinitionManager]);

  const handleDelete = useCallback(async (name: string) => {
    if (!agentDefinitionManager) return;
    await agentDefinitionManager.delete(name);
    setRefreshKey((k) => k + 1);
  }, [agentDefinitionManager]);

  const editorAgents = useMemo(() => agents.map((a) => ({
    name: a.name,
    title: a.title ?? '',
    description: a.description ?? '',
    model: a.model,
    systemPrompt: a.systemPrompt,
    tools: a.tools,
    permissions: a.permissions,
    color: a.color,
  })), [agents]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg text-white font-light">自定义 Agents</h2>
        <div className="flex items-center gap-3">
          {agentDefinitionManager && (
            <AgentPicker agents={pickerOptions} current={activeAgent} onSelect={handleSelect} />
          )}
          {onManage && <button onClick={onManage} className="text-[11px] text-cyan-500 hover:text-cyan-400">在设置中管理 →</button>}
        </div>
      </div>

      {!agentDefinitionManager ? (
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">Agent 定义管理器未初始化</p>
        </div>
      ) : (
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-5">
          <AgentEditorPanel agents={editorAgents} onSave={handleSave} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// IntegrationsPanelView — wraps IntegrationsPanel with manager wiring
// ════════════════════════════════════════════════════════════

export function IntegrationsPanelView({ integrationManager, onManage }: {
  integrationManager?: IntegrationManager;
  onManage?: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const integrations: IntegrationCardData[] = useMemo(() => {
    if (!integrationManager) return [];
    const manifests = integrationManager.listManifests();
    return manifests.map((m: any) => {
      const enabled = integrationManager.isEnabled(m.id);
      const creds: Record<string, string> = {};
      for (const f of m.authFields ?? []) {
        const v = integrationManager.getCredential(m.id, f.key);
        if (v !== undefined) creds[f.key] = v;
      }
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        enabled,
        authFields: (m.authFields ?? []).map((f: any) => ({
          key: f.key,
          label: f.label,
          secret: f.secret,
          placeholder: f.placeholder,
        })),
        credentials: creds,
      };
    });
  }, [integrationManager, refreshKey]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    if (!integrationManager) return;
    if (enabled) {
      const existing = integrations.find((i) => i.id === id);
      await integrationManager.enable(id, existing?.credentials ?? {});
    } else {
      await integrationManager.disable(id);
    }
    setRefreshKey((k) => k + 1);
  }, [integrationManager, integrations]);

  const handleCredentialChange = useCallback(async (id: string, key: string, value: string) => {
    if (!integrationManager) return;
    const manifest = integrationManager.listManifests().find((m: any) => m.id === id);
    const creds: Record<string, string> = {};
    for (const f of manifest?.authFields ?? []) {
      const v = integrationManager.getCredential(id, f.key);
      if (v !== undefined) creds[f.key] = v;
    }
    creds[key] = value;
    await integrationManager.enable(id, creds);
    setRefreshKey((k) => k + 1);
  }, [integrationManager]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg text-white font-light">集成</h2>
        {onManage && <button onClick={onManage} className="text-[11px] text-cyan-500 hover:text-cyan-400">在设置中管理 →</button>}
      </div>

      {!integrationManager ? (
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">集成管理器未初始化</p>
        </div>
      ) : (
        <IntegrationsPanel
          integrations={integrations}
          onToggle={handleToggle}
          onCredentialChange={handleCredentialChange}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ChroniclePanel — screen memory management
// ════════════════════════════════════════════════════════════

export function ChroniclePanelExtra({ chronicleManager, onManage }: {
  chronicleManager?: ChronicleManager;
  onManage?: () => void;
}) {
  const [config, setConfig] = useState<any>(null);
  const [captures, setCaptures] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!chronicleManager) return;
    setConfig(chronicleManager.getConfig());
    setIsRunning(chronicleManager.isRunning());
    chronicleManager.getRecent(20).then((c) => setCaptures(c)).catch(() => setCaptures([]));
  }, [chronicleManager, refreshKey]);

  const handleStart = useCallback(async () => {
    if (!chronicleManager) return;
    await chronicleManager.updateConfig({ enabled: true });
    await chronicleManager.resume();
    setRefreshKey((k) => k + 1);
  }, [chronicleManager]);

  const handleStop = useCallback(async () => {
    if (!chronicleManager) return;
    await chronicleManager.updateConfig({ enabled: false });
    await chronicleManager.stop();
    setRefreshKey((k) => k + 1);
  }, [chronicleManager]);

  const handlePause = useCallback(async () => {
    if (!chronicleManager) return;
    await chronicleManager.pause(60);
    setRefreshKey((k) => k + 1);
  }, [chronicleManager]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg text-white font-light">屏幕记忆</h2>
        {onManage && <button onClick={onManage} className="text-[11px] text-cyan-500 hover:text-cyan-400">在设置中管理 →</button>}
      </div>

      {!chronicleManager ? (
        <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">Chronicle 管理器未初始化</p>
        </div>
      ) : (
        <>
          <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : config?.enabled ? 'bg-yellow-500' : 'bg-gray-600'}`} />
                <span className="text-sm text-white font-medium">
                  {isRunning ? '运行中' : config?.pausedUntil && config.pausedUntil > Date.now() ? '已暂停' : config?.enabled ? '已启用（未运行）' : '已停止'}
                </span>
                {config && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] text-gray-500">
                    每 {config.intervalSeconds}s · 保留 {config.retentionDays} 天
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isRunning ? (
                  <button
                    onClick={handleStart}
                    className="px-3 py-1 text-[11px] font-medium rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors"
                  >
                    启动
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="px-3 py-1 text-[11px] font-medium rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white transition-colors"
                  >
                    暂停
                  </button>
                )}
                <button
                  onClick={handleStop}
                  className="px-3 py-1 text-[11px] font-medium rounded-lg bg-[#333] hover:bg-[#444] text-gray-300 transition-colors"
                >
                  停止
                </button>
              </div>
            </div>
          </div>

          <h3 className="text-[13px] text-gray-400 font-medium mb-2">最近捕获 ({captures.length})</h3>
          {captures.length === 0 ? (
            <div className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-8 text-center">
              <p className="text-gray-500 text-sm">暂无屏幕捕获记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {captures.map((c: any) => (
                <div key={c.id} className="bg-[#2a2a2a] border border-[#383838] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {c.appContext && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400">{c.appContext}</span>
                      )}
                      {c.windowTitle && (
                        <span className="text-xs text-gray-400 truncate max-w-[300px]">{c.windowTitle}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-600">{new Date(c.capturedAt).toLocaleString()}</span>
                  </div>
                  {c.summary && <div className="text-[11px] text-gray-500 mt-1">{c.summary}</div>}
                  {c.ocrText && (
                    <div className="text-[10px] text-gray-600 mt-1 line-clamp-2 font-mono">{c.ocrText}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
