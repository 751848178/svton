import {icon,esc} from './ui.js';
import {projects} from './data.js';
import {serverLabel} from './project-entries.js';
import {pageTitle} from './page-title.js';

export function settingsView(checked=false) {
  return `<div class="page-head"><div>${pageTitle('连接与配置',{backAction:'projects',backLabel:'返回项目列表'})}<p class="subtle">发布前，检查本机控制端和远端是否准备就绪。</p></div><button class="button primary" data-action="check-connections">${icon('check')}检查配置</button></div>
    <section class="panel"><div class="panel-head"><h2>TWGG · ${esc(serverLabel(projects[0]))}</h2></div><div class="settings-list">
    <div class="setting-row"><div class="service-name">${icon('box')}<div><strong>本机控制端</strong><p class="service-copy">ship CLI · 0.5.0</p></div></div><span class="status good">${checked?'检查完成':'已安装'}</span></div>
    <div class="setting-row"><div class="service-name">${icon('server')}<div><strong>运行服务器</strong><p class="service-copy">${esc(serverLabel(projects[0]))} · runtime Agent</p></div></div><span class="status good">${checked?'检查完成':'已配对'}</span></div>
    <div class="setting-row"><div class="service-name">${icon('box')}<div><strong>镜像仓库</strong><p class="service-copy">腾讯云 TCR · shipkit-zxb · 私有</p></div></div><span class="status good">${checked?'检查完成':'已配置'}</span></div>
    <div class="setting-row"><div class="service-name">${icon('server')}<div><strong>动态构建机</strong><p class="service-copy">腾讯云广州 · 8 核 / 16 GB / 100 GB</p></div></div><span class="status neutral">按需创建</span></div>
    </div></section>
    <section class="panel recent-panel"><div class="panel-head"><h2>工具版本</h2></div><div class="panel-body"><p>工具版本为 <strong>0.5.0</strong>。本机和运行端需要主动升级，临时构建机安装本机提供的版本。</p></div></section>`;
}
