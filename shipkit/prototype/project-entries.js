import { esc, icon } from './ui.js';

export function serverLabel(project) {
  return [project.host, project.serverName].filter(Boolean).join(' · ');
}

export function serviceEntry(service) {
  const label = `打开 ${service.name}（${service.id}），在新标签页中打开`;
  return `<a class="service-entry" href="${esc(service.entryUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}"><span class="service-entry-heading"><strong>${esc(service.id)}</strong>${icon('external',13)}</span><span class="service-copy">${esc(service.name)}</span></a>`;
}
