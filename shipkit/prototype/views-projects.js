import {icon,esc,status,time} from './ui.js';
import {serverLabel,serviceEntry} from './project-entries.js';
import {pageTitle} from './page-title.js';
import {presentationText} from './presentation-text.js';

export function projectsView(projects) {
  return `<div class="page-head"><div><h1>项目</h1><p class="subtle">选择一个项目，查看服务并开始发布。</p></div><span class="subtle">${projects.length} 个项目</span></div>
    <section class="panel"><div class="panel-head"><h2>本机项目</h2><span class="subtle">已保存的连接与发布配置</span></div>
    <div class="table-wrap"><table class="project-list"><thead><tr><th>项目</th><th>运行服务器</th><th>应用服务</th><th>最新发布</th><th></th></tr></thead><tbody>
    ${projects.map(p=>`<tr><td><div class="project-name"><span class="project-icon">${icon('box',23)}</span><div><button class="project-entry" data-action="open-project" data-project="${esc(p.id)}" aria-label="进入 ${esc(p.name)} 项目详情"><strong>${esc(p.name)}</strong></button><p>${esc(p.description)}</p></div></div></td><td data-label="运行服务器"><span class="server-address mono">${esc(p.host)}</span><p class="subtle">${esc(p.serverName)}</p></td><td data-label="服务">${p.services.map(s=>`<span class="service-pill">${esc(s.id)}</span>`).join('')}</td><td data-label="最新发布">${status(p.history[0]?.result)}<p class="subtle">${time(p.history[0]?.at ?? Date.now())}</p></td><td><button class="button secondary small" data-action="open-project" data-project="${esc(p.id)}">进入项目 ${icon('arrow',16)}</button></td></tr>`).join('')}
    </tbody></table></div></section>`;
}

export function projectHead(p, section = '', busy = false) {
  return `<div class="breadcrumbs"><button data-action="projects">项目</button>${icon('arrow',13)}<span>${esc(p.name)}</span>${section ? `${icon('arrow',13)}<span>${esc(section)}</span>` : ''}</div>
    <div class="page-head"><div>${pageTitle(p.name,{section,backAction:section?'overview':'projects',backLabel:section?'返回项目详情':'返回项目列表',busy})}<p class="subtle">${esc(p.description)} · 运行服务器 ${esc(serverLabel(p))}</p></div>
    ${section ? '' : `<div class="head-actions"><button class="button secondary" data-action="history">${icon('history')}发布记录</button><button class="button primary" data-action="start-wizard">${icon('play')}开始发布</button></div>`}</div>`;
}

export function overviewView(p, state) {
  const builderLabels={none:'当前无构建机',released:'构建机已释放',active:'构建机运行中','release-failed':'构建机待释放'};
  return `${projectHead(p)}<div class="detail-grid"><section class="panel"><div class="panel-head"><h2>当前应用服务</h2><span class="subtle">${p.services.length} 个服务</span></div>
    <div class="table-wrap"><table class="service-table"><thead><tr><th>服务</th><th>当前版本</th><th>端口</th><th>状态</th></tr></thead><tbody>
    ${p.services.map(s=>`<tr><td><div class="service-name">${icon(s.id === 'backend' ? 'server' : 'box')}<div>${serviceEntry(s)}</div></div></td><td><span class="version">${esc(presentationText(state.versions[s.id]))}</span></td><td class="mono">${esc(s.port)}</td><td><span class="status good">${icon('check',14)}运行中</span></td></tr>`).join('')}
    </tbody></table></div><div class="panel-body subtle">点击服务名，在新标签页打开服务入口。支持单独更新服务，未选择的服务沿用当前版本。</div></section>
    <aside class="panel"><div class="panel-head"><h2>发布配置</h2></div><dl class="context-list"><dt>源码分支</dt><dd class="mono">${esc(p.branch)}</dd><dt>提交</dt><dd class="mono">${esc(presentationText(p.commit))}</dd><dt>运行服务器</dt><dd>${esc(serverLabel(p))}</dd><dt>镜像仓库</dt><dd>腾讯云 TCR · 私有</dd><dt>构建方式</dt><dd>按需创建，用完释放</dd></dl><div class="panel-body builder-state">${icon('server')}<span>${builderLabels[state.builder.status]}<span class="subtle">${state.builder.id?esc(presentationText(state.builder.id)):'发布时创建'}</span></span></div></aside></div>
    <section class="panel recent-panel"><div class="panel-head"><h2>最近发布</h2><button class="button ghost small" data-action="history">全部记录 ${icon('arrow',14)}</button></div>
    <div class="recent-release">${status(state.history[0]?.result)}<div><strong>${esc(presentationText(state.history[0]?.id))}</strong><p class="subtle">${esc(state.history[0]?.selected.join('、'))} · ${time(state.history[0]?.at ?? Date.now())}</p></div></div></section>`;
}
