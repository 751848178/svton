import { MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { globalNavigation } from "../navigation.js";

export function GlobalNavigation({ screen, go, onNavigate }) {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => filterSections(query), [query]);
  const projectActive = ["directory", "overview", "repository", "config", "domains", "releases", "release", "deployments"].includes(screen);

  return (
    <>
      <label className="menu-search">
        <MagnifyingGlass size={15} />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索菜单" aria-label="搜索菜单" />
      </label>
      <div className="global-nav-scroll">
        {sections.map((section) => (
          <section className="global-nav-section" key={section.label}>
            <h2>{section.label}</h2>
            <nav aria-label={section.label}>
              {section.items.map(({ label, icon: Icon, screen: target }) => {
                const active = target === "directory" && projectActive;
                return (
                  <button
                    key={label}
                    className={active ? "active" : ""}
                    onClick={() => {
                      if (!target) return;
                      go(target);
                      onNavigate?.();
                    }}
                    aria-current={active ? "page" : undefined}
                    aria-disabled={!target}
                    title={target ? undefined : "本原型未覆盖此全局页面"}
                  >
                    {active && <span className="nav-active-mark" aria-hidden="true" />}
                    <Icon size={16} weight={active ? "fill" : "regular"} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </section>
        ))}
        {sections.length === 0 && <p className="menu-empty">没有匹配的菜单</p>}
      </div>
    </>
  );
}

function filterSections(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return globalNavigation;
  return globalNavigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.label.toLowerCase().includes(normalized)),
    }))
    .filter((section) => section.items.length > 0);
}
