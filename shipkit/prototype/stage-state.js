import {stages} from './release-simulation.js';
import {presentationText} from './presentation-text.js';

export function stageState(state,index) {
  const healthFailed=index===4 && (state.runScenario??state.scenario)==='health-failure' && (state.stage>4 || state.phase==='recovered');
  const cleanupFailed=index===5 && state.builder.status==='release-failed';
  if(healthFailed)return {kind:'failed',label:'失败，已恢复',description:'健康检查失败，已恢复选中服务的原版本。'};
  if(cleanupFailed)return {kind:'failed',label:'释放失败',description:'释放尚未确认，请重试处理临时资源。'};
  if(state.phase==='cancelled' && index===state.stage)return {kind:'cancelled',label:'已取消',description:'执行已取消，已恢复原版本并处理已创建的构建机。'};
  if(state.phase==='running' && index===state.stage)return {kind:'active',label:'执行中',description:presentationText(stages[index].description)};
  if(index<state.stage || ['success','recovered','cleanup-failed'].includes(state.phase))return {kind:'done',label:'完成',description:presentationText(stages[index].description)};
  return {kind:'waiting',label:state.phase==='cancelled'?'未执行':'等待',description:presentationText(stages[index].description)};
}

export function stageLogs(state,stageId) {
  return state.logs.filter(log=>log.stageId===stageId);
}
