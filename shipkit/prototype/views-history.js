import {icon,esc,status,time,versionsText} from './ui.js';
import {projectHead} from './views-projects.js';
import {serverLabel} from './project-entries.js';
import {presentationText} from './presentation-text.js';

export function historyView(p,state) {
  return `${projectHead(p,'发布记录',state.phase==='running')}<section class="panel"><div class="panel-head"><div><h2>版本与发布记录</h2><p class="subtle">${state.history.length} 条发布记录</p></div><button class="button primary" data-action="start-wizard" ${state.phase==='running'?'disabled':''}>开始新发布</button></div><div class="table-wrap"><table class="service-table history-table"><thead><tr><th>发布</th><th>范围</th><th>时间</th><th>结果</th><th>操作</th></tr></thead><tbody>${state.history.map(r=>`<tr><td><strong class="mono">${esc(presentationText(r.id))}</strong><p class="subtle">${r.kind==='rollback'?'按服务回滚':'应用发布'}</p></td><td>${r.selected.map(s=>`<span class="service-pill">${esc(s)}</span>`).join('')}</td><td>${time(r.at)}</td><td>${status(r.result)}</td><td><button class="button ghost small" data-action="view-record" data-record="${esc(r.id)}">查看</button><button class="button secondary small" data-action="review-rollback" data-record="${esc(r.id)}" ${['success','cleanup-failed'].includes(r.result)?'':'disabled'}>${icon('history',14)}回滚</button></td></tr>`).join('')}</tbody></table></div></section>`;
}

export function recordDialog(p,record) {
  return `<div class="dialog-head"><h2 id="dialog-title">发布记录</h2><button class="button ghost small" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div><div class="dialog-body"><p class="mono">${esc(presentationText(record.id))}</p><dl class="context-list"><dt>项目</dt><dd>${esc(p.name)}</dd><dt>运行服务器</dt><dd>${esc(serverLabel(p))}</dd><dt>时间</dt><dd>${time(record.at)}</dd><dt>服务</dt><dd>${esc(record.selected.join('、'))}</dd><dt>结果</dt><dd>${status(record.result)}</dd><dt>变更后版本</dt><dd>${esc(presentationText(versionsText(record.afterVersions,record.selected)))}</dd></dl></div><div class="dialog-footer"><button class="button secondary" data-action="close-dialog">关闭</button></div>`;
}

export function rollbackDialog(p,record) {
  return `<div class="dialog-head"><h2 id="dialog-title">选择回滚范围</h2><button class="button ghost small" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div><div class="dialog-body"><p>撤销 <strong class="mono">${esc(presentationText(record.id))}</strong> 对所选服务的更新。</p><div class="rollback-list">${record.selected.map(id=>`<label class="rollback-option"><input type="checkbox" data-rollback-service="${esc(id)}" checked><span><strong>${esc(id)}</strong><span class="service-copy">恢复至 ${esc(presentationText(record.beforeVersions[id]))}</span></span></label>`).join('')}</div><p class="subtle">其他服务继承当前版本。回滚不创建构建机，也不回滚数据库。</p></div><div class="dialog-footer"><button class="button secondary" data-action="close-dialog">取消</button><button class="button primary" data-action="confirm-rollback" data-record="${esc(record.id)}">确认回滚</button></div>`;
}
