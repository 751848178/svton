import test from 'node:test';
import assert from 'node:assert/strict';
import { createModel, stages } from './model.js';
import { addLog } from './release-simulation.js';

const model = () => createModel({ tickMs: 1 });
test('service changes invalidate the plan and empty selection cannot run', async () => {
  const m = model();
  assert.deepEqual(m.makePlan().inherited, ['backend', 'mobile']);
  m.toggleService('admin');
  assert.equal(m.state.plan, null);
  assert.throws(() => m.makePlan(), /至少选择/);
  await assert.rejects(m.run(), /发布计划/);
  assert.equal(m.state.builder.status, 'none');
});

test('project switching invalidates the plan while state identity stays stable', () => {
  const m = model(), state = m.state;
  m.makePlan(); m.selectProject('demo-web');
  assert.equal(m.state, state);
  assert.equal(m.state.plan, null);
  assert.deepEqual(m.state.selected, ['web']);
  assert.equal(m.state.versions.web, 'demo-v2');
});

test('selective release preserves unselected versions and other projects keep their own history', async () => {
  const m = model(), original = { ...m.state.versions };
  m.makePlan(); assert.equal(await m.run(), 'success');
  assert.equal(m.state.versions.backend, original.backend);
  assert.equal(m.state.versions.mobile, original.mobile);
  assert.notEqual(m.state.versions.admin, original.admin);
  assert.equal(m.state.builder.status, 'released');
  const latest = m.state.versions.admin;
  m.selectProject('demo-web'); assert.equal(m.state.versions.web, 'demo-v2');
  m.selectProject('twgg'); assert.equal(m.state.versions.admin, latest);
  assert.equal(m.state.history[0].result, 'success');
});

test('health failure recovers original versions and releases the builder', async () => {
  const m = model(), original = { ...m.state.versions };
  m.selectAll(); m.makePlan(); m.setScenario('health-failure');
  assert.equal(await m.run(), 'recovered');
  assert.deepEqual(m.state.versions, original);
  assert.equal(m.state.builder.status, 'released');
  assert.equal(m.state.history[0].result, 'recovered');
  assert.notEqual(m.makePlan().baseReleaseId, m.state.history[0].id);
  const failures = m.state.logs.filter(log => log.message.includes('健康检查失败'));
  assert.equal(failures.length, 1);
  assert.equal(failures[0].stageId, 'health');
  const recovery = m.state.logs.filter(log => log.message.includes('原版本模拟健康检查通过'));
  assert.deepEqual(recovery.map(log => log.stageId), ['health', 'health', 'health']);
  assert.ok(!m.state.logs.some(log => log.message.includes('健康检查 · 完成')));
});

test('cleanup failure keeps deployed services and never reports overall success before retry', async () => {
  const m = model(), original = { ...m.state.versions };
  m.makePlan(); m.setScenario('cleanup-failure');
  assert.equal(await m.run(), 'cleanup-failed');
  assert.equal(m.state.builder.status, 'release-failed');
  assert.equal(m.state.history[0].result, 'cleanup-failed');
  assert.notEqual(m.state.versions.admin, original.admin);
  assert.throws(() => m.selectProject('demo-web'), /先模拟释放/);
  assert.throws(() => m.resetRun(), /先模拟释放/);
  const retryLogStart = m.state.logs.length;
  await m.retryCleanup();
  assert.equal(m.state.phase, 'success');
  assert.equal(m.state.builder.status, 'released');
  assert.equal(m.state.history[0].result, 'success');
  assert.deepEqual(m.state.logs.slice(retryLogStart).map(log => log.stageId), ['release', 'release']);
  await assert.rejects(m.retryCleanup(), /没有待释放/);
});

test('rollback uses historical before versions for selected services without a builder', async () => {
  const m = model(), original = { ...m.state.versions };
  m.selectAll(); m.makePlan(); await m.run();
  const release = m.state.history[0], deployed = { ...m.state.versions };
  await m.rollback(release.id, ['admin']);
  assert.equal(m.state.versions.admin, original.admin);
  assert.equal(m.state.versions.backend, deployed.backend);
  assert.equal(m.state.versions.mobile, deployed.mobile);
  assert.equal(m.state.history[0].kind, 'rollback');
  assert.equal(m.state.history[0].beforeVersions.admin, deployed.admin);
  assert.equal(m.state.builder.status, 'none');
  await assert.rejects(m.rollback('unknown', ['admin']), /成功记录/);
});

test('an in-flight release cannot be duplicated and cancellation recovers its deployed version', async () => {
  const m = model(), original = { ...m.state.versions };
  m.makePlan();
  let cancellation;
  m.subscribe(state => {
    if (state.stage === 4 && state.phase === 'running' && !cancellation) {
      // Defer until pending has been assigned by the release orchestrator.
      cancellation = Promise.resolve().then(() => m.cancel());
    }
  });
  const running = m.run();
  await assert.rejects(m.run(), /尚未完成/);
  assert.throws(() => m.toggleService('backend'), /尚未完成/);
  assert.equal(await running, 'cancelled');
  assert.equal(await cancellation, true);
  assert.deepEqual(m.state.versions, original);
  assert.equal(m.state.builder.status, 'released');
  assert.equal(m.state.history[0].result, 'cancelled');
  const cancellationLogs = m.state.logs.filter(log => /取消|取消恢复/.test(log.message));
  assert.ok(cancellationLogs.length >= 3);
  assert.ok(cancellationLogs.every(log => log.stageId === 'health'));
  assert.ok(!m.state.logs.some(log => log.stageId === 'release'));
  assert.ok(!m.state.logs.some(log => log.message.includes('健康检查 · 完成')));
});

test('stages have a six-step cleanup gate and subscriptions can unsubscribe', () => {
  const m = model();
  assert.deepEqual(stages.map(stage => stage.id), ['create', 'build', 'push', 'deploy', 'health', 'release']);
  let count = 0;
  const unsubscribe = m.subscribe(() => count++);
  m.makePlan(); unsubscribe(); m.toggleService('backend');
  assert.equal(count, 2);
  assert.throws(() => m.setScenario('unknown'), /场景不存在/);
});

test('each release stage records concrete demonstration details in compatible flat logs', async () => {
  const m = model();
  m.makePlan(); await m.run();
  assert.deepEqual([...new Set(m.state.logs.map(log => log.stageId))], stages.map(stage => stage.id));
  assert.ok(m.state.logs.every(log => typeof log.time === 'string' && log.message.startsWith('[演示]')));
  const detailByStage = {
    create: /服务范围 admin/,
    build: /构建 admin：源码 master@a3d0c02 → 镜像 demo-registry\.invalid\/twgg\/admin:/,
    push: /推送 admin：.*模拟仓库接收与镜像标签回读一致/,
    deploy: /部署 admin：admin-prod \/ 端口 3101 绑定/,
    health: /健康检查 admin：版本 .*已模拟就绪/,
    release: /已模拟释放；回读确认无临时构建机/,
  };
  for (const [stageId, detail] of Object.entries(detailByStage)) {
    assert.ok(m.state.logs.some(log => log.stageId === stageId && detail.test(log.message)), stageId);
  }
  assert.ok(!m.state.logs.some(log => /构建 backend：|推送 mobile：|部署 backend：/.test(log.message)));
});

test('push-stage filtering keeps push evidence without other stage details', async () => {
  const m = model();
  m.selectAll(); m.makePlan(); await m.run();
  const pushLogs = m.state.logs.filter(log => log.stageId === 'push');
  assert.deepEqual(pushLogs.filter(log => log.message.includes('模拟仓库接收')).map(log =>
    log.message.match(/推送 ([^：]+)：/)[1]), ['backend', 'admin', 'mobile']);
  assert.ok(pushLogs.every(log => !/构建机|源码|端口|健康检查/.test(log.message)));
  assert.ok(m.state.logs.some(log => log.stageId === 'deploy' && log.message.includes('端口 3100')));
  assert.ok(m.state.logs.length > pushLogs.length);
});

test('log tags infer cleanup and system context while allowing explicit stage attribution', () => {
  const state = { logs: [], stage: -1, phase: 'running' };
  addLog(state, '模拟回滚');
  state.phase = 'cleanup-failed'; addLog(state, '模拟重试释放');
  state.stage = 2; addLog(state, '模拟推送');
  addLog(state, '模拟恢复检查', 'health');
  assert.deepEqual(state.logs.map(log => log.stageId), ['system', 'release', 'push', 'health']);
});

test('cancellation before builder creation has no later-stage completion evidence', async () => {
  const m = model();
  m.makePlan();
  let cancellation;
  m.subscribe(state => {
    if (state.stage === 0 && state.phase === 'running' && !cancellation) {
      cancellation = Promise.resolve().then(() => m.cancel());
    }
  });
  assert.equal(await m.run(), 'cancelled');
  assert.equal(await cancellation, true);
  assert.equal(m.state.builder.status, 'none');
  assert.ok(m.state.logs.every(log => log.stageId === 'create'));
  assert.ok(m.state.logs.some(log => log.message.includes('尚未创建构建机')));
  assert.ok(!m.state.logs.some(log => /已就绪|· 完成|已模拟释放/.test(log.message)));
});
