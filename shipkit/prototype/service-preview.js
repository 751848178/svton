import { projects } from './data.js';
import { esc } from './ui.js';
import { serverLabel } from './project-entries.js';
import { presentationText } from './presentation-text.js';

function findService(search) {
  const params = new URLSearchParams(search);
  const project = projects.find(item => item.id === params.get('project'));
  const service = project?.services.find(item => item.id === params.get('service'));
  if (!service?.entryUrl.startsWith('./service-preview.html?')) return null;
  return { project, service };
}

function serviceView({ project, service }) {
  return `<div class="page-head"><div><h1>${esc(service.name)}</h1><p class="subtle">${esc(project.name)} · ${esc(service.id)}</p></div></div>
    <section class="panel recent-panel"><div class="panel-head"><h2>服务信息</h2></div>
      <dl class="context-list service-preview-details"><dt>项目</dt><dd>${esc(project.name)}</dd><dt>服务</dt><dd>${esc(service.name)} · <span class="mono">${esc(service.id)}</span></dd><dt>运行服务器</dt><dd>${esc(serverLabel(project))}</dd><dt>端口</dt><dd class="mono">${esc(service.port)}</dd><dt>版本</dt><dd class="mono">${esc(presentationText(service.version))}</dd></dl></section>`;
}

function missingView() {
  return `<div class="page-head"><div><h1>服务未找到</h1><p class="subtle">请从发布面板中的项目详情打开服务入口。</p></div></div>`;
}

const entry = findService(window.location.search);
document.querySelector('#service-preview').innerHTML = entry ? serviceView(entry) : missingView();
if (entry) document.title = `${entry.service.name} · Shipkit`;
