import {stages} from './release-simulation.js';
import {stageLogs,stageState} from './stage-state.js';
import {esc,icon} from './ui.js';
import {presentationText} from './presentation-text.js';

export function createLogDrawer(dialog,getState) {
  let stageId=null,origin=null;
  function refresh() {
    if(!dialog.open || !stageId)return;
    const state=getState(),index=stages.findIndex(stage=>stage.id===stageId);
    const stage=stages[index],status=stageState(state,index),logs=stageLogs(state,stageId);
    dialog.querySelector('#stage-drawer-title').textContent=stage.label;
    dialog.querySelector('.drawer-status').className=`drawer-status status ${status.kind==='failed'?'error':status.kind==='done'?'good':'neutral'}`;
    dialog.querySelector('.drawer-status').textContent=status.label;
    dialog.querySelector('.drawer-description').textContent=status.description;
    dialog.querySelector('.drawer-scope').textContent=`本次服务：${state.selected.join('、')}`;
    const pre=dialog.querySelector('.drawer-log'),nearBottom=pre.scrollTop+pre.clientHeight>=pre.scrollHeight-24;
    pre.textContent=logs.map(log=>`${log.time}  ${presentationText(log.message)}`).join('\n');
    pre.hidden=!logs.length;
    dialog.querySelector('.drawer-empty').hidden=!!logs.length;
    dialog.querySelector('.drawer-empty p').textContent=status.kind==='waiting'?'该步骤尚未执行，暂无日志。执行到此步骤后会显示日志。':'等待此步骤的日志。';
    dialog.querySelector('.drawer-log-count').textContent=`${logs.length} 条日志`;
    if(nearBottom)pre.scrollTop=pre.scrollHeight;
  }
  function open(id,trigger) {
    if(!stages.some(stage=>stage.id===id))return;
    stageId=id;origin=trigger;
    dialog.innerHTML=`<div class="drawer-head"><div><h2 id="stage-drawer-title"></h2><p class="subtle">步骤日志</p></div><button class="dialog-close" data-close-drawer aria-label="关闭步骤日志">${icon('close',20)}</button></div>
      <div class="drawer-context"><span class="drawer-status status"></span><p class="drawer-description"></p><p class="drawer-scope subtle"></p></div>
      <div class="drawer-log-head"><h3>执行日志</h3><span class="drawer-log-count subtle"></span></div>
      <pre class="drawer-log" tabindex="0" aria-label="步骤日志"></pre>
      <div class="drawer-empty"><span>${icon('history',26)}</span><h3>还没有日志</h3><p class="subtle"></p></div>
      <div class="drawer-footer"><span class="subtle">仅展示此步骤的日志；执行中实时更新。</span><button class="button secondary" data-close-drawer>关闭日志</button></div>`;
    if(!dialog.open)dialog.showModal();
    refresh();dialog.querySelector('[data-close-drawer]').focus();
  }
  dialog.addEventListener('click',event=>{if(event.target===dialog || event.target.closest('[data-close-drawer]'))dialog.close();});
  dialog.addEventListener('close',()=>{
    const target=origin?.isConnected?origin:document.getElementById(`stage-${stageId}`);
    target?.focus({preventScroll:true});stageId=null;
  });
  return {open,refresh};
}
