import test from 'node:test';
import assert from 'node:assert/strict';
import {createModel} from './model.js';
import {releaseStepAccess,prepareReleaseStep} from './release-navigation.js';
import {stageState} from './stage-state.js';

const model=()=>createModel({tickMs:1});

test('entering execution prepares a plan without starting a release',()=>{
  const m=model(),before=structuredClone(m.state.versions),history=m.state.history.length;
  prepareReleaseStep(m,3);
  assert.ok(m.state.plan);
  assert.equal(m.state.phase,'idle');
  assert.equal(m.state.builder.status,'none');
  assert.deepEqual(m.state.logs,[]);
  assert.deepEqual(m.state.versions,before);
  assert.equal(m.state.history.length,history);
  assert.equal(releaseStepAccess(m.state,4).allowed,false);
});

test('empty selection and active runs enforce their navigation gates',async()=>{
  const m=model();m.toggleService('admin');
  for(const step of [2,3])assert.throws(()=>prepareReleaseStep(m,step),/至少选择/);
  assert.equal(releaseStepAccess(m.state,1).allowed,true);
  m.toggleService('admin');prepareReleaseStep(m,3);
  const running=m.run();
  for(const step of [1,2,4])assert.equal(releaseStepAccess(m.state,step).allowed,false);
  assert.equal(releaseStepAccess(m.state,3).allowed,true);
  await assert.rejects(m.run(),/尚未完成/);
  await running;
  for(const step of [1,2,3,4])assert.equal(releaseStepAccess(m.state,step).allowed,true);
});

test('a fresh plan allows another release with new history and current base versions',async()=>{
  const m=model(),history=m.state.history.length;
  prepareReleaseStep(m,3);await m.run();
  const first=structuredClone(m.state.history[0]),versions={...m.state.versions},firstLogs=m.state.logs;
  prepareReleaseStep(m,3);
  assert.equal(m.state.phase,'success');
  assert.equal(m.state.plan.baseReleaseId,first.id);
  await m.run();
  assert.equal(m.state.history.length,history+2);
  assert.notEqual(m.state.history[0].id,first.id);
  assert.deepEqual(m.state.history[0].beforeVersions,versions);
  assert.equal(m.state.history[1].id,first.id);
  assert.notEqual(m.state.logs,firstLogs);
  assert.equal(m.state.logs.filter(log=>log.stageId==='create'&&log.message.includes('· 开始')).length,1);
  assert.equal(m.state.versions.backend,versions.backend);
  assert.equal(m.state.versions.mobile,versions.mobile);
});

test('changing the next scenario preserves completed stage evidence',async()=>{
  const m=model();prepareReleaseStep(m,3);await m.run();
  m.setScenario('health-failure');
  assert.equal(stageState(m.state,4).kind,'done');
  prepareReleaseStep(m,3);assert.equal(await m.run(),'recovered');
  m.setScenario('success');
  assert.equal(stageState(m.state,4).kind,'failed');
});

test('pending cleanup permits result inspection but blocks another release until repair',async()=>{
  const m=model();m.setScenario('cleanup-failure');prepareReleaseStep(m,3);await m.run();
  assert.equal(releaseStepAccess(m.state,4).allowed,true);
  for(const step of [1,2])assert.throws(()=>prepareReleaseStep(m,step),/先释放/);
  assert.equal(releaseStepAccess(m.state,3).allowed,true);
  await assert.rejects(m.run(),/先模拟释放/);
  await m.retryCleanup();m.setScenario('success');prepareReleaseStep(m,3);
  assert.equal(await m.run(),'success');
});

test('completed simulated cancellation allows a new attempt without changing its history',async()=>{
  const m=model();prepareReleaseStep(m,3);
  const running=m.run();await m.cancel();await running;
  const cancelled=structuredClone(m.state.history[0]);
  assert.equal(releaseStepAccess(m.state,4).allowed,true);
  prepareReleaseStep(m,3);assert.equal(await m.run(),'success');
  assert.equal(m.state.history[1].result,'cancelled');
  assert.deepEqual(m.state.history[1],cancelled);
});

test('immediate cancellation of a repeated release has no previous builder evidence',async()=>{
  const m=model();prepareReleaseStep(m,3);await m.run();
  const previousBuilder=m.state.builder.id,versions={...m.state.versions};
  prepareReleaseStep(m,3);const repeated=m.run();
  assert.deepEqual(m.state.builder,{status:'none',id:null});
  await m.cancel();assert.equal(await repeated,'cancelled');
  assert.deepEqual(m.state.builder,{status:'none',id:null});
  assert.deepEqual(m.state.versions,versions);
  assert.ok(m.state.logs.some(log=>log.message.includes('尚未创建构建机')));
  assert.ok(m.state.logs.every(log=>!log.message.includes(previousBuilder)));
  assert.equal(m.state.history[1].result,'success');
});
