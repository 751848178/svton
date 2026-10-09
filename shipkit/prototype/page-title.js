import {icon,esc} from './ui.js';

export function pageTitle(title,{section='',backAction,backLabel,busy=false}={}) {
  return `<div class="page-title">${backAction?`<button class="title-back" data-action="${esc(backAction)}" aria-label="${esc(backLabel)}" title="${busy?'发布进行中，结束或取消后可返回':esc(backLabel)}" ${busy?'disabled':''}>${icon('back',20)}</button>`:''}<h1>${esc(title)}${section?`<span class="heading-separator">/</span>${esc(section)}`:''}</h1></div>`;
}
