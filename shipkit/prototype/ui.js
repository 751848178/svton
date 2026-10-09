const paths = {
  projects: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="17" r="3" fill="currentColor"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m12 19-7-7 7-7M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  history: '<path d="M3 11a9 9 0 1 1 3 7M3 4v7h7M12 7v5l3 2"/>',
  box: '<path d="m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M16 6.5h2M16 17.5h2"/>',
  warning: '<path d="m12 3 10 18H2L12 3ZM12 9v5M12 17h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  external: '<path d="M14 3h7v7M21 3 10 14M11 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
};
export function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
}
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function status(result) {
  const states = {success:['good','完成'],recovered:['warn','已恢复'], 'cleanup-failed':['warn','待释放'],cancelled:['neutral','已取消'],running:['neutral','执行中']};
  const [tone,label] = states[result] || ['neutral','未知'];
  return `<span class="status ${tone}">${icon(tone === 'good' ? 'check' : tone === 'warn' ? 'warning' : 'box',14)}${label}</span>`;
}
export function time(value) {
  return new Date(value).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
}
export function versionsText(versions, selected) {
  return selected.map(id => `${id} → ${versions[id] ?? '当前版本'}`).join(' / ');
}
