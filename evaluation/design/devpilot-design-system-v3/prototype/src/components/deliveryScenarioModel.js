export const scenarios = {
  rebuild: '新构建需要重新预发',
  interrupted: '生产请求中断',
  batch: '首批通过，等待确认',
  failed: '部分部署失败',
  access: '部署完成，入口未通过',
};

export function initialDelivery(scenario = 'rebuild') {
  const phase = { rebuild: 'staging', interrupted: 'unknown', batch: 'paused', failed: 'failed', access: 'access' }[scenario];
  return {
    scenario, phase, candidate: '制品 B', proven: scenario === 'rebuild' ? '制品 A' : '制品 B',
    current: scenario === 'access' ? '1.4.0' : '1.3.2', run: scenario === 'rebuild' ? null : 'PR-1042',
    history: ['1.3.2 · 历史稳定版本', ...(scenario === 'access' ? ['1.4.0 · 部署完成，待访问验收'] : [])],
    events: ['已读取当前发布的演示记录'],
  };
}

export const phaseCopy = {
  staging: ['warning', '新制品尚未通过预发', '制品 A 的验证记录保留。制品 B 必须单独部署并验证，才能进入生产。'],
  ready: ['success', '制品 B 已通过预发', '生产将复用制品 B。目标配置和审批仍需在确认时检查。'],
  unknown: ['warning', '生产请求已记录，执行结果待核对', '先读取运行与目标状态。结果不明确时禁止再次下发部署。'],
  resumable: ['warning', '已核对：部署尚未开始', '继续此次运行，不创建第二个生产请求；当前线上版本仍为 1.3.2。'],
  paused: ['warning', '首批已通过，等待继续', '第 1 台已部署并验证；剩余 2 台保持旧版本。此处演示按主机分批，不代表流量灰度。'],
  failed: ['blocked', '部分目标部署失败', '目标状态存在差异。已停止后续执行，当前环境未标记为整体升级成功。'],
  aborted: ['warning', '后续批次已中止', '尚未执行的目标保持旧版本；已成功目标不会因中止自动恢复。'],
  access: ['warning', '部署已完成，访问验证未通过', '工作负载健康，但域名 / TLS 探测失败。环境版本已更新，交付验收仍未完成。'],
  complete: ['success', '访问验证通过，交付完成', '工作负载、路由和 TLS 的演示证据均已通过。'],
  recovered: ['success', '已恢复历史稳定版本', '恢复创建独立记录，原失败运行与目标证据继续保留。'],
};

const allowed = {
  staging: ['stage'], ready: ['start'], unknown: ['inspect'], resumable: ['resume'],
  paused: ['continue', 'abort'], failed: ['recover'], aborted: ['recover'], access: ['verify'],
};

export function transitionDelivery(state, event) {
  if (!allowed[state.phase]?.includes(event)) return state;
  const next = { ...state, events: [...state.events] };
  const changes = {
    stage: { phase: 'ready', proven: '制品 B' },
    start: { phase: 'unknown', run: 'PR-1042' },
    inspect: { phase: 'resumable' }, resume: { phase: 'access', current: '1.4.0', history: [...state.history, '1.4.0 · 部署完成，待访问验收'] },
    continue: { phase: 'failed' }, abort: { phase: 'aborted' }, verify: { phase: 'complete' },
    recover: { phase: 'recovered', current: '1.3.2', history: [...state.history, 'RV-1043 · 恢复到 1.3.2'] },
  };
  const messages = {
    stage: '预发 B 部署与验证通过，保留 A 的证据', start: 'PR-1042 已创建；模拟响应中断，尚未执行',
    inspect: '回读确认尚未执行，可继续 PR-1042', resume: 'PR-1042 继续执行，部署完成；入口验证失败',
    continue: '第 2 台健康检查失败；第 3 台未执行', abort: '停止剩余批次，保留已完成目标',
    verify: '重新探测：DNS、TLS 与 HTTP 均通过', recover: '恢复 RV-1043 验证完成；保留 PR-1042 证据',
  };
  Object.assign(next, changes[event]);
  next.events.push(messages[event]);
  return next;
}

export function deliveryTargets(state) {
  if (['failed', 'aborted', 'paused'].includes(state.phase)) {
    return [['app-01', '1.4.0', '首批健康通过'], ['app-02', '1.3.2', state.phase === 'failed' ? '健康失败，已恢复旧版本' : '尚未执行'], ['app-03', '1.3.2', '尚未执行']];
  }
  return ['app-01', 'app-02', 'app-03'].map((name) => [name, state.current, state.phase === 'unknown' ? '待核对' : '健康']);
}
