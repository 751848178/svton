import {stages} from './release-simulation.js';
import {stageState} from './stage-state.js';
import {icon,esc} from './ui.js';
import {serverLabel} from './project-entries.js';
import {presentationText} from './presentation-text.js';

function builderView(state) {
  const status=state.builder.status;
  const labels={none:'未创建',active:'构建机运行中',released:'构建机已释放','release-failed':'构建机待释放'};
  const tone=status==='released'?'good':status==='release-failed'?'warn':'neutral';
  return `<section class="panel builder-panel"><div class="panel-head"><h2>构建机状态</h2></div><div class="panel-body builder-state">${icon('server',24)}<span><strong>${labels[status] || status}</strong><span class="subtle mono">${esc(presentationText(state.builder.id || '按需创建'))}</span></span></div>
    <div class="panel-body"><span class="status ${tone}">${status==='released'?icon('check',14):icon('server',14)}${status==='released'?'释放已确认':status==='release-failed'?'需重试释放':status==='active'?'运行中':'等待创建'}</span><p class="subtle">应用发布结果与构建机释放结果分别显示。</p>${status==='release-failed'?'<button class="button secondary" data-action="retry-cleanup">重试释放</button>':''}</div></section>`;
}

function stageView(state,index) {
  const stage=stages[index],status=stageState(state,index);
  return `<li class="stage ${status.kind}" data-stage-row="${stage.id}"><button class="stage-button" id="stage-${stage.id}" data-action="inspect-stage" data-stage="${stage.id}" aria-label="${stage.label}，${status.label}，查看日志"><span class="stage-marker">${icon(status.kind==='failed'?'warning':status.kind==='done'?'check':stage.id==='create'?'server':'box',16)}</span><span class="stage-content"><strong>${stage.label}</strong><span class="stage-description">${esc(status.description)}</span></span><span class="stage-state subtle">${status.label}</span><span class="stage-chevron">${icon('arrow',15)}</span></button></li>`;
}

function outcomeView(state) {
  if(['idle','running'].includes(state.phase))return '';
  const title=state.phase==='success'?'执行已完成':state.phase==='cleanup-failed'?'服务已上线，构建机待释放':state.phase==='cancelled'?'执行已取消':'检查失败，已恢复原版本';
  return `<div class="execution-outcome ${state.phase==='success'?'':'warning'}" role="status"><strong>${title}</strong><p>点击上方“查看结果”确认本次状态，或继续查看步骤日志。${state.phase==='cleanup-failed'?'先处理待释放构建机，再开始新发布。':'点击“再次发布”可手动开始新一轮。'}</p></div>`;
}

export function executionView(state) {
  const running=state.phase==='running',settled=!['idle','running'].includes(state.phase),blocked=state.builder.status==='release-failed';
  const label=running?'正在发布':settled?'再次发布':'开始发布';
  return `<div class="detail-grid"><section class="panel execution-panel" id="execution-stages"><div class="panel-head"><div><h2>执行发布</h2><p class="subtle execution-current">${running?`正在${stages[state.stage]?.label || '准备执行'}`:settled?'本轮执行已结束；可以查看日志或再次发布':'等待手动开始，尚未执行'} · ${esc(state.selected.join('、'))}</p></div><div class="execution-actions"><span class="tag execution-count">${Math.max(0,Math.min(state.stage+1,stages.length))} / ${stages.length}</span><button class="button secondary" data-action="cancel-run" ${!running?'hidden':''}>取消并恢复</button><button class="button primary" data-action="run" ${running||blocked?'disabled':''}>${icon('play',16)}${label}</button></div></div>
    ${blocked?'<p class="execution-blocked" role="status">构建机待释放。先在“构建机状态”中重试释放，确认后才能再次发布。</p>':''}<div class="execution-message">${outcomeView(state)}</div>
    <ol class="timeline">${stages.map((stage,index)=>stageView(state,index)).join('')}</ol><p class="subtle execution-hint">点击任一步骤，查看该步骤的具体日志。再次发布会重新构建与部署，生成新的发布记录。</p></section>${builderView(state)}</div>`;
}

export function resultView(p,state) {
  const success=state.phase==='success',cleanup=state.phase==='cleanup-failed',cancelled=state.phase==='cancelled';
  const title=success?'发布完成':cleanup?'服务已上线，构建机尚未释放':cancelled?'发布已取消':'健康检查失败，已恢复原版本';
  const description=success?`${state.selected.join('、')} 已更新，运行检查与构建机释放均完成。`:cleanup?'应用切换成功，释放步骤失败。请重试释放，避免遗漏临时资源。':cancelled?`保留原服务版本，${state.builder.status==='none'?'尚未创建构建机。':'临时构建机已释放。'}`:'本次更新未完成；已恢复被修改的服务版本，并释放构建机。';
  return `<section class="result-banner ${success?'success':'warning'}" role="status"><span class="result-symbol">${icon(success?'check':'warning',27)}</span><div><h2 class="result-title">${title}</h2><p>${esc(description)}</p><div class="result-actions"><button class="button secondary" data-action="history">查看发布记录</button><button class="button primary" data-action="start-wizard" ${cleanup?'disabled':''}>开始新发布</button></div></div></section>
    <div class="detail-grid"><section class="panel"><div class="panel-head"><h2>最终服务版本</h2><span class="subtle">${esc(serverLabel(p))}</span></div><div class="change-list">${p.services.map(s=>`<div class="change-row"><strong>${esc(s.id)}</strong><span class="version">${esc(presentationText(state.versions[s.id]))}</span><span class="tag ${state.selected.includes(s.id)?'selected':''}">${state.selected.includes(s.id)?success||cleanup?'已更新':'原版本':'继承'}</span></div>`).join('')}</div></section>${builderView(state)}</div>`;
}
