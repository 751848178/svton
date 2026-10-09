export const releaseSteps=['选择服务','核对计划','执行发布','查看结果'];
const finishedPhases=new Set(['success','recovered','cleanup-failed','cancelled']);

export function releaseStepAccess(state,step) {
  if(!Number.isInteger(step)||step<1||step>4)return {allowed:false,reason:'发布步骤不存在。'};
  if(state.phase==='running'&&step!==3)return {allowed:false,reason:'发布进行中，结束或取消后可切换。'};
  if(step===4)return finishedPhases.has(state.phase)
    ?{allowed:true,reason:''}:{allowed:false,reason:'本次执行结束后可查看结果。'};
  if(state.builder.status==='release-failed'&&step!==3)return {allowed:false,reason:'先释放待处理构建机，再准备新发布。'};
  if(step>1&&!state.selected.length)return {allowed:false,reason:'请先至少选择一个服务。'};
  return {allowed:true,reason:''};
}

export function prepareReleaseStep(model,step) {
  const access=releaseStepAccess(model.state,step);
  if(!access.allowed)throw new Error(access.reason);
  if([2,3].includes(step)&&model.state.phase!=='running'&&model.state.builder.status!=='release-failed')model.makePlan();
}

export function releaseStepHint(state) {
  if(state.phase==='running')return '发布进行中，结束或取消后可切换；点击执行步骤可以查看日志。';
  if(state.builder.status==='release-failed')return '构建机待释放，处理后才能准备新发布；可以查看本次结果。';
  if(!state.selected.length)return '请至少选择一个服务，再核对计划或进入执行。';
  return finishedPhases.has(state.phase)?'点击步骤名称切换；在执行页可手动再次发布。':'点击步骤名称切换；查看结果将在本次执行结束后开放。';
}
