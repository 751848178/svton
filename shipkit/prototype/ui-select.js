import {esc,icon} from './ui.js';

let active=null,initialized=false,onSelect=()=>{};

export function selectView({id,label,value,options}) {
  const selected=options.find(option=>String(option.value)===String(value)) || options[0];
  const current=selected?String(selected.value):'';
  return `<div class="select-control" data-select="${esc(id)}">
    <label id="${esc(id)}-label" for="${esc(id)}">${esc(label)}</label>
    <button type="button" id="${esc(id)}" class="select-trigger" data-select-trigger value="${esc(current)}" data-value="${esc(current)}" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${esc(id)}-listbox" aria-labelledby="${esc(id)}-label ${esc(id)}-value" ${options.length?'':'disabled'}><span id="${esc(id)}-value" data-select-label>${esc(selected?.label ?? '暂无选项')}</span><span class="select-chevron">${icon('arrow',14)}</span></button>
    <div id="${esc(id)}-listbox" class="select-menu" role="listbox" aria-labelledby="${esc(id)}-label" popover="manual" hidden>
      ${options.map((option,index)=>`<div id="${esc(id)}-option-${index}" class="select-option" role="option" aria-selected="${String(option.value)===current}" data-select-option="${esc(option.value)}"><span data-option-label>${esc(option.label)}</span><span class="select-check">${icon('check',15)}</span></div>`).join('')}
    </div></div>`;
}

function highlight(index) {
  if(!active)return;
  active.index=Math.max(0,Math.min(active.options.length-1,index));
  active.options.forEach((option,i)=>{option.dataset.active=String(i===active.index);});
  const option=active.options[active.index];
  active.trigger.setAttribute('aria-activedescendant',option.id);
  option.scrollIntoView({block:'nearest'});
}

function positionMenu() {
  if(!active)return;
  const {trigger,menu}=active,rect=trigger.getBoundingClientRect(),margin=12,gap=6;
  const width=Math.min(Math.max(rect.width,224),window.innerWidth-margin*2);
  menu.style.width=`${width}px`;
  menu.style.left=`${Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin))}px`;
  const wanted=Math.min(menu.scrollHeight+2,264);
  const below=window.innerHeight-rect.bottom-gap-margin,above=rect.top-gap-margin;
  const opensBelow=below>=wanted || below>=above;
  const height=Math.max(0,Math.min(wanted,opensBelow?below:above));
  menu.style.maxHeight=`${height}px`;
  menu.style.top=`${opensBelow?rect.bottom+gap:Math.max(margin,rect.top-gap-height)}px`;
}

function closeMenu(restoreFocus=false) {
  if(!active)return;
  const {trigger,menu,root,observer}=active;
  active=null;observer.disconnect();
  if(typeof menu.hidePopover==='function' && menu.matches(':popover-open'))menu.hidePopover();
  menu.hidden=true;
  if(menu.parentNode!==root)root.append(menu);
  trigger.setAttribute('aria-expanded','false');
  trigger.removeAttribute('aria-activedescendant');
  if(restoreFocus && trigger.isConnected)trigger.focus({preventScroll:true});
}

function openMenu(trigger,index) {
  if(trigger.disabled)return;
  closeMenu();
  const root=trigger.closest('[data-select]'),menu=root.querySelector('[role="listbox"]');
  const options=[...menu.querySelectorAll('[role="option"]')];
  if(!options.length)return;
  const observer=new MutationObserver(()=>{if(!trigger.isConnected)closeMenu();});
  active={trigger,menu,root,options,index:0,observer};
  menu.hidden=false;
  if(typeof menu.showPopover==='function')menu.showPopover();
  else document.body.append(menu);
  trigger.setAttribute('aria-expanded','true');
  positionMenu();
  highlight(index ?? Math.max(0,options.findIndex(option=>option.getAttribute('aria-selected')==='true')));
  observer.observe(document.body,{childList:true,subtree:true});
}

function choose(option) {
  if(!active || !active.options.includes(option))return;
  const {trigger,options}=active,value=option.dataset.selectOption;
  const changed=trigger.value!==value;
  trigger.value=value;trigger.dataset.value=value;
  trigger.querySelector('[data-select-label]').textContent=option.querySelector('[data-option-label]').textContent;
  options.forEach(item=>item.setAttribute('aria-selected',String(item===option)));
  closeMenu(true);
  if(changed)onSelect(trigger.id,value);
}

function handleClick(event) {
  const trigger=event.target.closest('[data-select-trigger]');
  if(trigger){
    if(active?.trigger===trigger)closeMenu(true);
    else openMenu(trigger);
    return;
  }
  const option=event.target.closest('[data-select-option]');
  if(option)choose(option);
  else if(active && !active.menu.contains(event.target))closeMenu();
}

function handleKey(event) {
  const trigger=event.target.closest('[data-select-trigger]');
  if(!trigger)return;
  const expanded=active?.trigger===trigger;
  if(event.key==='Tab'){if(expanded)closeMenu();return;}
  if(event.key==='Escape'){
    if(expanded){event.preventDefault();closeMenu(true);}
    return;
  }
  if(!['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key))return;
  event.preventDefault();
  if(!expanded){
    openMenu(trigger,event.key==='Home'?0:event.key==='End'?Infinity:undefined);
    return;
  }
  if(event.key==='Enter' || event.key===' ')choose(active.options[active.index]);
  else highlight(event.key==='Home'?0:event.key==='End'?Infinity:active.index+(event.key==='ArrowDown'?1:-1));
}

export function initSelects(onChange) {
  onSelect=typeof onChange==='function'?onChange:()=>{};
  if(initialized)return;
  initialized=true;
  document.addEventListener('click',handleClick);
  document.addEventListener('keydown',handleKey);
  document.addEventListener('pointerdown',event=>{
    if(!active)return;
    if(active.menu.contains(event.target)){
      if(event.target.closest('[data-select-option]'))event.preventDefault();
    }
    else if(!active.trigger.contains(event.target))closeMenu();
  });
  document.addEventListener('focusin',event=>{
    if(active && event.target!==active.trigger && !active.menu.contains(event.target))closeMenu();
  });
  document.addEventListener('scroll',positionMenu,true);
  window.addEventListener('resize',positionMenu);
}
