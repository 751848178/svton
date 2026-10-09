import {projects} from './data.js';
import {createModel} from './model.js';
import {icon} from './ui.js';
import {projectsView,overviewView} from './views-projects.js';
import {wizardView} from './views-wizard.js';
import {historyView,recordDialog,rollbackDialog} from './views-history.js';
import {settingsView} from './views-settings.js';
import {patchExecution} from './execution-render.js';
import {releaseCommand} from './release-command.js';
import {initSelects} from './ui-select.js';
import {createLogDrawer} from './ui-log-drawer.js';
import {prepareReleaseStep} from './release-navigation.js';
import {createNavigationShell} from './navigation-shell.js';
import {presentationText} from './presentation-text.js';

const model=createModel({tickMs:1500}), main=document.querySelector('#content');
const dialog=document.querySelector('#release-dialog'),navigation=createNavigationShell();
let view='projects',step=1,checked=false,toastTimer,frame=0,silentScenario=false,cleanupRunning=false;
const stageDrawer=createLogDrawer(document.querySelector('#stage-drawer'),()=>model.state);
const summaries=new Map(projects.map(p=>[p.id,p]));
const project=()=>projects.find(p=>p.id===model.state.projectId);
const notify=message=>{
  const el=document.querySelector('#toast'); clearTimeout(toastTimer);
  el.textContent=presentationText(message);el.hidden=false;
  toastTimer=setTimeout(()=>{el.hidden=true;},3000);
};

function render() {
  const state=model.state,p=project(),busy=state.phase==='running';
  if(busy && view==='wizard' && step===3 && main.dataset.progressActive==='true'){
    patchExecution(main,state);return;
  }
  const active=document.activeElement,inside=main.contains(active);
  const focus=active?.id?`#${CSS.escape(active.id)}`:active?.dataset.action?`[data-action="${active.dataset.action}"]`:null;
  summaries.set(p.id,{...p,history:state.history});
  navigation.render(view,p,busy);
  const content=view==='projects'?projectsView(projects.map(x=>summaries.get(x.id))):view==='overview'?overviewView(p,state):view==='history'?historyView(p,state):view==='settings'?settingsView(checked):wizardView(p,state,step);
  const showResourceAlert=state.builder.status==='release-failed'&&!(view==='wizard'&&step>=3);
  main.innerHTML=(showResourceAlert?`<div class="resource-alert" role="status">${icon('warning')}<span>有 1 台构建机待释放。服务已上线，请先处理临时资源。</span><button class="button secondary small" data-action="retry-cleanup">重试释放</button></div>`:'')+content;
  main.dataset.progressActive=String(busy && view==='wizard' && step===3);
  if(state.builder.status==='release-failed')main.querySelectorAll('[data-action="start-wizard"]').forEach(b=>{b.disabled=true;b.title='请先重试释放构建机';});
  const focusTarget=focus&&main.querySelector(focus);
  if(inside)(focusTarget&&!focusTarget.hidden?focusTarget:main).focus({preventScroll:true});
  document.title=`${view==='projects'?'项目':p.name} · Shipkit`;
}

function go(target,nextStep=1) {
  if(model.state.phase==='running')return notify('发布进行中，请等待结束或取消后再切换。');
  cancelAnimationFrame(frame);view=target;step=nextStep;navigation.close();render();main.focus({preventScroll:true});
  document.querySelector('.workspace').scrollTo({top:0});window.scrollTo(0,0);
}
function showDialog(html) {
  dialog.innerHTML=html;dialog.showModal();
}
function command() {
  const selected=model.state.plan?.selected || model.state.selected;
  return releaseCommand(project(),selected);
}

const actions={
  projects:()=>go('projects'),overview:()=>go('overview'),history:()=>go('history'),settings:()=>go('settings'),
  'open-project':button=>{model.selectProject(button.dataset.project);go('overview');},
  'start-wizard':()=>{model.resetRun();go('wizard');},
  'select-all':()=>{
    if(model.state.selected.length===project().services.length)[...model.state.selected].forEach(id=>model.toggleService(id));
    else model.selectAll();
  },
  'make-plan':()=>{prepareReleaseStep(model,2);go('wizard',2);},
  'select-step':button=>{
    const target=Number(button.dataset.step);
    if(view==='wizard'&&step===target)return;
    prepareReleaseStep(model,target);go('wizard',target);
  },
  run:()=>{model.makePlan();model.run().catch(error=>notify(error.message));},
  'inspect-stage':button=>stageDrawer.open(button.dataset.stage,button),
  'cancel-run':()=>model.cancel(),
  'retry-cleanup':async button=>{
    cleanupRunning=true;button.disabled=true;
    try{await model.retryCleanup();notify('构建机已释放。');}
    finally{cleanupRunning=false;button.disabled=false;}
  },
  'copy-command':async()=>{await navigator.clipboard.writeText(command());notify('已复制发布命令。');},
  'view-record':button=>showDialog(recordDialog(project(),model.state.history.find(r=>r.id===button.dataset.record))),
  'review-rollback':button=>showDialog(rollbackDialog(project(),model.state.history.find(r=>r.id===button.dataset.record))),
  'confirm-rollback':async button=>{
    const selected=[...dialog.querySelectorAll('[data-rollback-service]:checked')].map(el=>el.dataset.rollbackService);
    if(!selected.length)return notify('请至少选择一个回滚服务。');
    const id=button.dataset.record;dialog.close();
    await model.rollback(id,selected);go('history');notify(`已回滚 ${selected.join('、')}，未创建构建机。`);
  },
  'close-dialog':()=>dialog.close(),
  'check-connections':()=>{checked=true;render();notify('检查完成。');},
};

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');
  if(!button || button.disabled)return;
  if(button.tagName==='A')event.preventDefault();
  try{await actions[button.dataset.action]?.(button);}
  catch(error){notify(error.message || '操作未完成，请重试。');}
});
document.addEventListener('change',event=>{
  const el=event.target;
  try{
    if(el.dataset.service)model.toggleService(el.dataset.service);
    if(el.dataset.rollbackService)dialog.querySelector('[data-action="confirm-rollback"]').disabled=!dialog.querySelector('[data-rollback-service]:checked');
  }catch(error){notify(error.message);}
});
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
initSelects((id,value)=>{
  if(id!=='scenario')return;
  silentScenario=true;
  try{model.setScenario(value);}catch(error){notify(error.message);}finally{silentScenario=false;}
});
model.subscribe(state=>{
  stageDrawer.refresh();
  if(silentScenario || (cleanupRunning && state.phase==='cleanup-failed'))return;
  cancelAnimationFrame(frame);frame=requestAnimationFrame(render);
});
