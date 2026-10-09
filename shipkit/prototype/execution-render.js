import {executionView} from './views-execution.js';

// Keep interactive rows stable while progress changes, including drawer return targets.
export function patchExecution(root,state) {
  const next=document.createElement('div');next.innerHTML=executionView(state);
  for(const button of root.querySelectorAll('.stage-button')) {
    const replacement=next.querySelector(`#${button.id}`);
    if(!replacement)continue;
    button.closest('.stage').className=replacement.closest('.stage').className;
    button.setAttribute('aria-label',replacement.getAttribute('aria-label'));
    for(const selector of ['.stage-marker','.stage-description','.stage-state'])button.querySelector(selector).innerHTML=replacement.querySelector(selector).innerHTML;
  }
  for(const selector of ['.execution-current','.execution-count','.builder-panel','.execution-message']) {
    const current=root.querySelector(selector),replacement=next.querySelector(selector);
    if(current.innerHTML!==replacement.innerHTML)current.innerHTML=replacement.innerHTML;
  }
  root.querySelector('[data-action="cancel-run"]').hidden=state.phase!=='running';
  root.querySelector('[data-action="run"]').disabled=state.phase==='running'||state.builder.status==='release-failed';
}
