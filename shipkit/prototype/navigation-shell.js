import {icon} from './ui.js';
import {navigationView} from './views-navigation.js';

export function createNavigationShell() {
  const layout=document.querySelector('.app-layout'),workspace=document.querySelector('.workspace');
  const sidebar=document.querySelector('#sidebar'),navigation=document.querySelector('#navigation');
  const search=document.querySelector('#menu-search'),opener=document.querySelector('#open-navigation');
  const dialog=document.querySelector('#navigation-drawer'),desktop=matchMedia('(min-width:741px)');
  let context=null;
  opener.innerHTML=icon('menu',20);
  sidebar.querySelector('[data-navigation-close]').innerHTML=icon('close',20);
  sidebar.querySelector('.menu-search').insertAdjacentHTML('afterbegin',icon('search',14));
  sidebar.querySelector('.server-avatar').innerHTML=icon('server',18);
  function restore() {
    layout.insertBefore(sidebar,workspace);opener.setAttribute('aria-expanded','false');
  }
  function close() {
    if(dialog.open)dialog.close();
    restore();
  }
  function render(view,project,busy) {
    context={view,project,busy};navigation.innerHTML=navigationView(view,project,busy,search.value);
  }
  function refreshSearch() {if(context)render(context.view,context.project,context.busy);}
  opener.addEventListener('click',()=>{
    if(desktop.matches||dialog.open)return;
    dialog.append(sidebar);dialog.showModal();opener.setAttribute('aria-expanded','true');
    sidebar.querySelector('[data-navigation-close]').focus();
  });
  dialog.addEventListener('close',restore);
  dialog.addEventListener('click',event=>{
    if(event.target===dialog||event.target.closest('[data-navigation-close]'))close();
  });
  search.addEventListener('input',refreshSearch);
  navigation.addEventListener('click',event=>{
    if(event.target.closest('[data-navigation-clear]')){search.value='';refreshSearch();search.focus();}
  });
  desktop.addEventListener('change',()=>{if(desktop.matches){close();document.querySelector('#content').focus({preventScroll:true});}});
  return {render,close};
}
