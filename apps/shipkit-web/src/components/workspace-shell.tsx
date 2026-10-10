'use client';
import { useState } from 'react';
import { Drawer } from '@svton/ui';
import { LayoutGrid, Menu, Search, Server, X } from 'lucide-react';
import type { Location, View } from '@/hooks/use-navigation';
import type { AuthenticatedProps } from '@/auth/contracts';
import { UserControls } from '@/auth/user-controls';

interface Props extends AuthenticatedProps {
  busy: boolean;
  view: View;
  navigate: (next: Partial<Location>) => void;
  children: React.ReactNode;
}
export function WorkspaceShell(props: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const go = (next: Partial<Location>) => { if (!props.busy) { props.navigate(next); setOpen(false); } };
  const items = [
    { label: '项目', view: 'projects' as const, icon: LayoutGrid, group: '项目管理' },
    { label: 'Agent 资源', view: 'agents' as const, icon: Server, group: '资源管理' },
  ].filter(item => item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const sidebar = (mobile: boolean) => <aside className="sidebar">
    <header className="sidebar-brand"><div>
      <a className="brand" href="/" onClick={event => { event.preventDefault(); go({ view: 'projects', projectId: '', taskId: '' }); }}>
        <img src="/mark.svg" alt="" width={32} height={32} /><span>Shipkit</span>
      </a><p className="sidebar-caption">发布工作台</p>
    </div>{mobile && <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="关闭导航"><X size={20} /></button>}</header>
    <div className="menu-search"><Search size={14} aria-hidden="true" /><input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索菜单" aria-label="搜索菜单" /></div>
    <nav id={mobile ? 'mobile-navigation' : 'navigation'} aria-label="主导航">
      {['项目管理', '资源管理'].filter(group => items.some(item => item.group === group)).map(group => <div className="nav-group" key={group}><div className="nav-group-label">{group}</div><div className="nav-items">{items.filter(item => item.group === group).map(item => {
        const active = item.view === 'agents' ? props.view === 'agents' : props.view !== 'agents';
        return <button key={item.view} className={`nav-item ${active ? 'active' : ''}`} disabled={props.busy} aria-current={active ? 'page' : undefined}
            onClick={() => go({ view: item.view, taskId: '', projectId: '' })}>
            <item.icon size={16} aria-hidden="true" /><span>{item.label}</span>
          </button>;
      })}</div></div>)}
      {!items.length && <p className="nav-empty">没有匹配的菜单</p>}
    </nav>
    <footer className="sidebar-footer"><UserControls user={props.user} onLogout={props.onLogout} /></footer>
  </aside>;
  return <div className="app-layout">
    {sidebar(false)}
    <div className="workspace"><div className="mobile-bar"><button id="open-navigation" onClick={() => setOpen(true)} aria-label="打开导航" aria-expanded={open}><Menu size={20} /></button>
      <a className="brand" href="/" onClick={event => { event.preventDefault(); go({ view: 'projects', projectId: '', taskId: '' }); }}><img src="/mark.svg" alt="" width={28} height={28} />Shipkit</a>
    </div><main id="content">{props.children}</main></div>
    <Drawer open={open} onClose={() => setOpen(false)} placement="left" width={280} aria-label="主导航" showCloseButton={false} bodyClassName="!p-0 !overflow-hidden" className="!bg-[#fafafa]">
      {sidebar(true)}
    </Drawer>
  </div>;
}
