import { projects } from './data.js';
import { stages, addLog, simulateRelease, wait } from './release-simulation.js';
export { stages };

export function createModel({ tickMs = 700 } = {}) {
  const listeners = new Set();
  const saved = new Map(projects.map(project => [project.id, {
    versions: Object.fromEntries(project.services.map(service => [service.id, service.version])),
    history: structuredClone(project.history),
  }]));
  const state = {
    projectId: null, selected: [], plan: null, scenario: 'success', runScenario: null, phase: 'idle',
    stage: -1, logs: [], builder: { status: 'none', id: null }, history: [], versions: {},
  };
  let sequence = 0, pending = null, cancelRequested = false, planSignature = null, activeRelease = false;
  const notify = () => listeners.forEach(listener => listener(state));
  const project = () => projects.find(item => item.id === state.projectId);
  const signature = () => JSON.stringify([state.projectId, state.selected, state.versions]);
  const assertSettled = () => {
    if (pending || state.phase === 'running') throw new Error('当前模拟操作尚未完成。');
    if (state.builder.status === 'release-failed') throw new Error('请先模拟释放待清理的构建机。');
  };
  const clearRun = () => {
    state.plan = null; planSignature = null; state.phase = 'idle'; state.stage = -1;
    state.logs = []; state.runScenario = null; state.builder = { status: 'none', id: null };
  };
  const record = (id, kind, selected, result, beforeVersions) => {
    const entry = {
      id, at: new Date().toISOString(), kind, selected: [...selected],
      result, beforeVersions: { ...beforeVersions }, afterVersions: { ...state.versions },
    };
    state.history.unshift(entry);
    return entry;
  };
  const selectProject = id => {
    assertSettled();
    const target = projects.find(item => item.id === id);
    if (!target) throw new Error('项目不存在。');
    if (state.projectId) saved.set(state.projectId, { versions: state.versions, history: state.history });
    const previous = saved.get(id);
    Object.assign(state, { projectId: id, versions: previous.versions, history: previous.history });
    state.selected = [target.services.find(item => item.id === 'admin')?.id ?? target.services[0].id];
    state.scenario = 'success'; clearRun(); notify();
  };
  const toggleService = id => {
    assertSettled();
    if (!project().services.some(service => service.id === id)) throw new Error('服务不存在。');
    state.selected = state.selected.includes(id) ? state.selected.filter(item => item !== id) : [...state.selected, id];
    clearRun(); notify();
  };
  const selectAll = () => {
    assertSettled(); state.selected = project().services.map(service => service.id); clearRun(); notify();
  };
  const makePlan = () => {
    assertSettled();
    if (!state.selected.length) throw new Error('请至少选择一个服务。');
    state.plan = {
      selected: [...state.selected],
      inherited: project().services.filter(item => !state.selected.includes(item.id)).map(item => item.id),
      baseReleaseId: state.history.find(item => item.result === 'success')?.id ?? null,
      branch: project().branch, commit: project().commit,
    };
    planSignature = signature(); notify(); return state.plan;
  };
  const setScenario = value => {
    assertSettled();
    if (!['success', 'health-failure', 'cleanup-failure'].includes(value)) throw new Error('演示场景不存在。');
    state.scenario = value; notify();
  };
  const run = async () => {
    assertSettled();
    if (!state.plan || !state.selected.length || signature() !== planSignature) throw new Error('请先生成有效的发布计划。');
    const selected = [...state.plan.selected], beforeVersions = { ...state.versions };
    const id = `demo-release-${++sequence}`;
    state.phase = 'running'; state.stage = -1; state.logs = []; state.builder = { status: 'none', id: null };
    state.runScenario = state.scenario; cancelRequested = false; activeRelease = true;
    pending = simulateRelease({ state, selected, beforeVersions, releaseId: id, scenario: state.scenario,
      tickMs, notify, cancelled: () => cancelRequested });
    try {
      const result = await pending;
      record(id, 'release', selected, result, beforeVersions);
      state.plan = null; planSignature = null; notify(); return result;
    } finally { pending = null; activeRelease = false; }
  };
  const cancel = async () => {
    if (state.phase !== 'running' || !pending || !activeRelease) return false;
    cancelRequested = true; addLog(state, '正在取消模拟发布并恢复原版本…'); notify();
    await pending; return true;
  };
  const retryCleanup = async () => {
    if (pending || state.phase !== 'cleanup-failed' || state.builder.status !== 'release-failed') {
      throw new Error('当前没有待释放的模拟构建机。');
    }
    addLog(state, '正在重新模拟释放构建机…'); notify(); pending = wait(tickMs);
    try {
      await pending; state.builder.status = 'released'; state.phase = 'success';
      state.history[0].result = 'success'; addLog(state, '构建机模拟释放成功，发布已完成。'); notify();
      return true;
    } finally { pending = null; }
  };
  const rollback = async (recordId, serviceIds) => {
    assertSettled();
    const target = state.history.find(item => item.id === recordId && item.result === 'success');
    if (!target) throw new Error('没有可回滚的成功记录。');
    const selected = [...new Set(serviceIds ?? target.selected)];
    const allowed = new Set(project().services.map(service => service.id));
    if (!selected.length || selected.some(id => !allowed.has(id) || !target.beforeVersions[id])) {
      throw new Error('请选择具有原版本记录的服务。');
    }
    const beforeVersions = { ...state.versions };
    clearRun(); state.selected = selected; state.phase = 'running';
    addLog(state, `正在模拟回滚 ${selected.join('、')}；无需创建构建机。`); notify();
    pending = wait(tickMs);
    try {
      await pending;
      for (const id of selected) state.versions[id] = target.beforeVersions[id];
      state.phase = 'success'; record(`demo-rollback-${++sequence}`, 'rollback', selected, 'success', beforeVersions);
      addLog(state, '模拟回滚完成；未选中的服务与数据库保持不变。'); notify(); return true;
    } finally { pending = null; }
  };
  const resetRun = () => { assertSettled(); clearRun(); notify(); };
  const subscribe = listener => { listeners.add(listener); listener(state); return () => listeners.delete(listener); };
  selectProject(projects[0].id);
  return { state, subscribe, selectProject, toggleService, selectAll, makePlan, setScenario, run,
    cancel, retryCleanup, rollback, resetRun };
}
