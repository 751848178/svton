import { Bell, List, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useState } from "react";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { GlobalNavigation } from "./GlobalNavigation.jsx";

export function AppShell({ screen, go, openAction, children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavRef = useDialogFocus(mobileNavOpen, () => setMobileNavOpen(false));
  return (
    <div className="app-shell">
      <aside className="global-rail">
        <button className="brand" onClick={() => go("directory")} aria-label="返回 Devpilot 工作台">
          <img src="/devpilot-cube-mark.png" alt="" />
          <span>Devpilot</span>
        </button>
        <GlobalNavigation screen={screen} go={go} />
        <div className="team-switcher">
          <span className="avatar">AC</span>
          <span>
            <strong>Acme Lab</strong>
            <small>团队工作区</small>
          </span>
        </div>
      </aside>

      <div className="app-stage">
        <header className="utility-bar">
          <button className="mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="打开全局导航" aria-expanded={mobileNavOpen}>
            <List size={20} />
          </button>
          <button className="mobile-brand" onClick={() => go("directory")}>
            <img src="/devpilot-cube-mark.png" alt="" />
            <span>Devpilot</span>
          </button>
          <label className="global-search">
            <MagnifyingGlass size={17} />
            <input aria-label="搜索项目、发布或运行" placeholder="搜索项目、发布或运行" />
            <kbd>⌘ K</kbd>
          </label>
          <button className="icon-button" aria-label="通知" onClick={() => openAction("notifications")}>
            <Bell size={19} />
          </button>
          <button className="account-button" onClick={() => openAction("account")}>
            <span className="avatar small">赵</span>
            <span>赵行波</span>
          </button>
        </header>
        {children}
      </div>
      {mobileNavOpen && (
        <div className="mobile-nav-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMobileNavOpen(false)}>
          <aside ref={mobileNavRef} className="mobile-global-nav" role="dialog" aria-modal="true" aria-label="全局导航" tabIndex={-1}>
            <header>
              <strong>导航</strong>
              <button onClick={() => setMobileNavOpen(false)} aria-label="关闭全局导航">
                <X size={19} />
              </button>
            </header>
            <GlobalNavigation screen={screen} go={go} onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
