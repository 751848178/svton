// Simulated lifecycle: this module never invokes cloud, shell, or network APIs.
import { projects } from './data.js';

export const stages = [
  { id: 'create', label: '创建构建机', description: '模拟按量构建机就绪' },
  { id: 'build', label: '构建镜像', description: '仅构建本次选中的服务' },
  { id: 'push', label: '推送镜像', description: '模拟推送至私有镜像仓库' },
  { id: 'deploy', label: '部署服务', description: '模拟运行端替换选中的服务' },
  { id: 'health', label: '健康检查', description: '模拟检查新版本，失败时恢复原版本' },
  { id: 'release', label: '释放构建机', description: '模拟回读确认临时资源已释放' },
];
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export function addLog(state, message, stageId = stages[state.stage]?.id ?? (state.phase === 'cleanup-failed' ? 'release' : 'system')) {
  state.logs.push({ time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), message, stageId });
}
function cancelSimulation(state, selected, beforeVersions) {
  const deployed = selected.some(id => state.versions[id] !== beforeVersions[id]);
  Object.assign(state.versions, beforeVersions);
  state.phase = 'cancelled';
  addLog(state, `[演示] 已取消当前步骤；${deployed ? '本次服务已恢复原版本' : '尚未替换服务版本'}。`);
  if (deployed) for (const id of selected) addLog(state, `[演示] 取消恢复：${id} → ${beforeVersions[id]}。`);
  if (state.builder.status === 'none') {
    addLog(state, '[演示] 尚未创建构建机，无临时资源需要释放。');
  } else {
    state.builder.status = 'released';
    addLog(state, `[演示] 取消清理：${state.builder.id} 已模拟释放，回读确认无临时构建机。`);
  }
}
export async function simulateRelease(context) {
  const { state, selected, beforeVersions, releaseId, scenario, tickMs, notify, cancelled } = context;
  const project = projects.find(item => item.id === state.projectId);
  const image = id => `demo-registry.invalid/${project.id}/${id}:${releaseId}`;
  let recovered = false;
  for (let index = 0; index < stages.length; index++) {
    state.stage = index;
    const stageId = stages[index].id;
    addLog(state, `[演示] ${stages[index].label} · 开始`);
    if (stageId === 'create') addLog(state, `[演示] 构建机申请：发布 ${releaseId}，服务范围 ${selected.join('、')}。`);
    if (stageId === 'release') addLog(state, `[演示] 请求释放临时构建机 ${state.builder.id}，等待模拟回读确认。`);
    notify();
    await wait(tickMs);
    if (cancelled()) {
      cancelSimulation(state, selected, beforeVersions);
      notify();
      return 'cancelled';
    }
    if (stageId === 'create') {
      state.builder = { status: 'active', id: `demo-builder-${releaseId}` };
      addLog(state, `[演示] 构建机 ${state.builder.id} 已就绪；模拟工作目录关联 ${project.branch}@${project.commit}。`);
    }
    if (stageId === 'build') for (const id of selected) {
      addLog(state, `[演示] 构建 ${id}：源码 ${project.branch}@${project.commit} → 镜像 ${image(id)}；模拟构建完成。`);
    }
    if (stageId === 'push') for (const id of selected) {
      addLog(state, `[演示] 推送 ${id}：${image(id)}；模拟仓库接收与镜像标签回读一致。`);
    }
    if (stageId === 'deploy') for (const id of selected) {
      const service = project.services.find(item => item.id === id);
      state.versions[id] = releaseId;
      addLog(state, `[演示] 部署 ${id}：${service.target} / 端口 ${service.port} 绑定 ${image(id)}；${beforeVersions[id]} → ${releaseId}。`);
    }
    if (stageId === 'health' && scenario === 'health-failure') {
      Object.assign(state.versions, beforeVersions);
      recovered = true;
      addLog(state, `[演示] 健康检查失败：${selected.join('、')} 的新版本未通过模拟检查，开始恢复原版本。`);
      for (const id of selected) addLog(state, `[演示] 恢复 ${id} → ${beforeVersions[id]}；原版本模拟健康检查通过。`);
      addLog(state, '[演示] 本次服务已恢复，继续释放临时构建机。');
    } else if (stageId === 'health') {
      for (const id of selected) addLog(state, `[演示] 健康检查 ${id}：版本 ${releaseId} 已模拟就绪。`);
    } else if (stageId === 'release' && scenario === 'cleanup-failure') {
      state.builder.status = 'release-failed';
      state.phase = 'cleanup-failed';
      addLog(state, `[演示] 应用已更新；构建机 ${state.builder.id} 模拟释放失败，回读仍存在，等待重试清理。`);
      notify();
      return 'cleanup-failed';
    } else if (stageId === 'release') {
      state.builder.status = 'released';
      addLog(state, `[演示] 构建机 ${state.builder.id} 已模拟释放；回读确认无临时构建机。`);
    }
    if (!(stageId === 'health' && recovered)) addLog(state, `[演示] ${stages[index].label} · 完成`);
    notify();
  }
  state.phase = recovered ? 'recovered' : 'success';
  addLog(state, recovered ? '[演示] 新版本未上线；原版本已恢复，构建机已释放。' : '[演示] 模拟发布成功，选中服务已更新，构建机已释放。');
  notify();
  return state.phase;
}
