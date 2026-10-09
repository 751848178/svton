import {icon,esc} from './ui.js';
import {projectHead} from './views-projects.js';
import {executionView,resultView} from './views-execution.js';
import {releaseCommand} from './release-command.js';
import {selectView} from './ui-select.js';
import {serverLabel} from './project-entries.js';
import {releaseStepsView} from './views-release-steps.js';
import {presentationText} from './presentation-text.js';

export function wizardView(p,state,step) {
  return `${projectHead(p,'发布',state.phase==='running')}${releaseStepsView(state,step)}
    <div class="wizard-body">${step===1?selectionView(p,state):step===2?planView(p,state):step===3?executionView(state):resultView(p,state)}</div>`;
}

function selectionView(p,state) {
  return `<section class="panel"><div class="panel-head"><div><h2>选择本次更新的服务</h2><p class="subtle">可以全量发布，也可以只更新其中几个服务。</p></div><div class="head-actions"><button class="button ghost small" data-action="select-all">${state.selected.length===p.services.length?'取消全选':'全选'}</button><button class="button primary" data-action="make-plan" ${!state.selected.length?'disabled':''}>生成发布计划 ${icon('arrow',16)}</button></div></div>
    <div class="table-wrap"><table class="service-table selectable"><thead><tr><th>选择</th><th>应用服务</th><th>当前版本</th><th>本次处理</th></tr></thead><tbody>
    ${p.services.map(s=>`<tr class="${state.selected.includes(s.id)?'selected-row':''}"><td><input type="checkbox" data-service="${esc(s.id)}" id="service-${esc(s.id)}" aria-label="选择 ${esc(s.id)}" ${state.selected.includes(s.id)?'checked':''}></td><td><label for="service-${esc(s.id)}" class="service-name">${icon(s.id==='backend'?'server':'box')}<span><strong>${esc(s.id)}</strong><span class="service-copy">${esc(s.name)}</span></span></label></td><td class="version">${esc(presentationText(state.versions[s.id]))}</td><td>${state.selected.includes(s.id)?'<span class="tag selected">构建并更新</span>':'<span class="subtle">沿用当前版本</span>'}</td></tr>`).join('')}
    </tbody></table></div><div class="selection-summary"><strong>已选 ${state.selected.length} / ${p.services.length} 个服务</strong><span class="subtle">${state.selected.length?`更新 ${esc(state.selected.join('、'))}`:'请至少选择一个服务'}</span></div></section>
    <div class="source-strip"><span>源码 <strong class="mono">${esc(p.branch)}</strong><span class="mono subtle">${esc(presentationText(p.commit))}</span></span><span class="status good">${icon('check',14)}工作区干净</span><span>运行服务器 <strong>${esc(serverLabel(p))}</strong></span></div>`;
}

function planView(p,state) {
  const plan=state.plan;
  if(!plan)return '<p>计划已失效，请返回选择服务。</p>';
  return `<div class="plan-grid"><section class="panel"><div class="panel-head"><div><h2>本次发布计划</h2><p class="subtle">核对更新范围，再开始执行。</p></div><span class="tag">${plan.selected.length} 个服务更新</span></div>
    <div class="change-list">${p.services.map(s=>`<div class="change-row ${plan.inherited.includes(s.id)?'inherited':''}"><div class="service-name">${icon(s.id==='backend'?'server':'box')}<strong>${esc(s.id)}</strong></div><div><span class="version">${esc(presentationText(state.versions[s.id]))}</span>${plan.selected.includes(s.id)?`<span class="change-arrow">${icon('arrow',15)}</span><span class="next-version">本次新构建</span>`:''}</div><span class="tag ${plan.selected.includes(s.id)?'selected':''}">${plan.selected.includes(s.id)?'构建 → 推送 → 部署':'继承当前镜像'}</span></div>`).join('')}</div>
    <div class="panel-body plan-note"><strong>发布到 ${esc(serverLabel(p))}</strong><p>源分支 ${esc(plan.branch)} · 提交 ${esc(presentationText(plan.commit))}。${plan.inherited.length?`${esc(plan.inherited.join('、'))} 不参与本次切换。`:'本次更新所有应用服务。'}</p><p class="subtle">MySQL、Redis 与归档沿用已有绑定。应用镜像回滚不回滚数据库。</p></div></section>
    <aside class="panel"><div class="panel-head"><h2>本次构建资源</h2></div><dl class="context-list"><dt>构建机</dt><dd>腾讯云按量实例</dd><dt>规格</dt><dd>8 核 / 16 GB / 100 GB</dd><dt>区域</dt><dd>${esc(p.region)}</dd><dt>生命周期</dt><dd>发布后主动释放<br><span class="subtle">同时设置定时销毁</span></dd><dt>运行服务器</dt><dd>${esc(serverLabel(p))}</dd></dl></aside></div>
    <details class="command-details"><summary>查看 AI Agent 命令</summary><div class="command-row"><code>${esc(releaseCommand(p,plan.selected))}</code><button class="button ghost small" data-action="copy-command">${icon('copy',15)}复制</button></div></details>
    <div class="scenario-select">${selectView({id:'scenario',label:'执行场景',value:state.scenario,options:[{value:'success',label:'正常发布'},{value:'health-failure',label:'健康检查失败，恢复旧版本'},{value:'cleanup-failure',label:'服务上线，但构建机释放失败'}]})}</div>`;
}
