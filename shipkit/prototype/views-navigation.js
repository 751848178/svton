import {esc,icon} from './ui.js';
import {serverLabel} from './project-entries.js';

export function navigationView(view,project,busy,query='') {
  const inProject=['overview','wizard','history'].includes(view),term=query.trim().toLowerCase();
  const groups=[{label:'项目管理',items:[
    {action:'projects',label:'项目列表',icon:'projects',active:view==='projects'},
    ...(inProject?[
      {action:'overview',label:'项目详情',icon:'box',active:['overview','wizard'].includes(view),keywords:project.name},
      {action:'history',label:'发布记录',icon:'history',active:view==='history',keywords:project.name},
    ]:[]),
  ]},{label:'系统管理',items:[{action:'settings',label:'连接与配置',icon:'settings',active:view==='settings'}]}];
  const visible=groups.map(group=>({...group,items:group.items.filter(item=>
    `${item.label} ${item.keywords||''}`.toLowerCase().includes(term))})).filter(group=>group.items.length);
  return `${inProject?`<div class="nav-project"><strong>${esc(project.name)}</strong><span class="nav-server">${esc(serverLabel(project))}</span></div>`:''}${visible.length?visible.map(group=>`<section class="nav-group"><h2 class="nav-group-label">${group.label}</h2><div class="nav-items">${group.items.map(item=>`<button class="nav-item ${item.active?'active':''}" data-action="${item.action}" ${item.active?'aria-current="page"':''} ${busy?'disabled':''}>${icon(item.icon,16)}<span>${item.label}</span></button>`).join('')}</div></section>`).join(''):'<div class="nav-empty" role="status"><p>没有匹配的菜单</p><button class="button ghost small" data-navigation-clear>清空搜索</button></div>'}`;
}
