import {esc} from './ui.js';
import {releaseSteps,releaseStepAccess,releaseStepHint} from './release-navigation.js';

export function releaseStepsView(state,step) {
  const descriptions=['选择更新范围','确认服务与服务器','手动开始并查看日志','确认最终状态'];
  return `<nav aria-label="发布步骤"><ol class="stepper devpilot-steps">${releaseSteps.map((label,i)=>{
    const access=releaseStepAccess(state,i+1);
    return `<li class="step-item ${i+1===step?'is-active':i+1<step?'is-complete':'is-future'}"><button class="step-link" id="release-step-${i+1}" data-action="select-step" data-step="${i+1}" ${i+1===step?'aria-current="step"':''} ${access.allowed?'':'disabled'} title="${esc(access.reason||`切换到${label}`)}"><span class="step-label">${label}</span><span class="step-description">${descriptions[i]}</span></button></li>`;
  }).join('')}</ol><p class="step-guidance subtle">${esc(releaseStepHint(state))}</p></nav>`;
}
