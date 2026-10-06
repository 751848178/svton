import { useState } from 'react';
import { GearSix, MagnifyingGlass } from '@phosphor-icons/react';
import { components, environmentVersions, projectHeader, releaseRows } from '../view-models.js';
import { Button, ScreenTitle, Status } from '../components/ui.jsx';

export function ProjectDirectoryScreen({ go }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [columns, setColumns] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('prototype-directory-columns')); return Array.isArray(saved) ? saved.filter((key) => environmentVersions[key]) : []; } catch { return []; }
  });
  const visible = status !== 'needs_configuration' && `${projectHeader.name} ${projectHeader.repo}`.toLowerCase().includes(query.toLowerCase());
  const toggle = (key) => {
    const next = columns.includes(key) ? columns.filter((item) => item !== key) : [...columns, key];
    setColumns(next);
    try { localStorage.setItem('prototype-directory-columns', JSON.stringify(next)); } catch { /* In-memory selection remains available. */ }
  };
  return <main className="project-stage directory-page">
    <ScreenTitle as="h1" title="我的项目" description="查看项目交付状态、运行版本和最近发布。" />
    <p className="prototype-source-note">交互原型 · 示例数据</p>
    <section className="directory-summary" aria-label="项目汇总">{[['项目总数', 1], ['已上线', 1], ['待配置', 0]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="directory-list" aria-label="项目列表">
      <div className="directory-toolbar"><label><MagnifyingGlass size={17} /><input aria-label="搜索项目" placeholder="搜索项目名称或仓库" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <select aria-label="项目状态筛选" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">全部状态</option><option value="online">已上线</option><option value="needs_configuration">待配置</option></select><span>共 {visible ? 1 : 0} 个项目</span>
      </div>
      <details className="directory-column-settings"><summary><GearSix size={16} />配置环境列</summary><div>{Object.entries(environmentVersions).map(([key, item]) => <label key={key}><input type="checkbox" checked={columns.includes(key)} onChange={() => toggle(key)} />{item.label}</label>)}</div></details>
      <div className="data-table-wrap"><table className="data-table directory-table" aria-label="我的项目列表"><thead><tr>{['项目', '状态', '组件', '运行版本', '最近发布', ...columns.map((key) => environmentVersions[key]?.label), '操作'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{visible ? <tr><td><button className="release-name" onClick={() => go('overview')}><strong>{projectHeader.name}</strong><small>{projectHeader.repo}</small></button></td><td><Status value="success">已上线</Status></td><td>{components.length} 个组件</td><td>生产 {environmentVersions.production.version}</td><td><strong>{releaseRows[0].version}</strong><small className="directory-secondary">已阻断 · 生产</small></td>{columns.map((key) => <td key={key}>{environmentVersions[key]?.version}</td>)}<td><button className="table-action" onClick={() => go('overview')}>查看项目</button></td></tr> : <tr><td colSpan={6 + columns.length}><div className="directory-empty"><p>没有符合条件的项目</p><Button variant="secondary" onClick={() => { setQuery(''); setStatus('all'); }}>重置筛选</Button></div></td></tr>}</tbody>
      </table></div>
    </section>
  </main>;
}
