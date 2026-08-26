function projectTitle(parent, options = {}) {
  const crumb = frame(parent, { width: "fill_container", height: 24, layout: "horizontal", gap: 8, alignItems: "center" });
  text(crumb, "项目", { fontSize: 13, fontWeight: 600, fill: F(T.blue) });
  text(crumb, "/", { fontSize: 13, fill: F(T.faint) });
  text(crumb, "Picshare", { fontSize: 13, fontWeight: 500, fill: F(T.ink) });

  const row = frame(parent, { width: "fill_container", height: 64, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const identity = frame(row, { width: "fit_content", height: 58, layout: "horizontal", gap: 12, alignItems: "center" });
  const folder = frame(identity, { width: 38, height: 38, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 8, fill: F(T.blue50) });
  icon(folder, "folder", { width: 21, height: 21, fill: F(T.blue) });
  const copy = frame(identity, { width: 560, height: "fit_content", layout: "vertical", gap: 4 });
  text(copy, "Picshare", { fontSize: 23, fontWeight: 700, fill: F(T.ink) });
  const meta = frame(copy, { width: "fit_content", height: 22, layout: "horizontal", gap: 9, alignItems: "center" });
  text(meta, "仓库", { fontSize: 12, fill: F(T.muted) });
  text(meta, "file://read-only-repositories/picshare", { fontSize: 12, fill: F(T.body) });
  icon(meta, "link", { width: 14, height: 14, fill: F(T.blue) });
  text(meta, "·", { fontSize: 12, fill: F(T.faint) });
  text(meta, "默认分支", { fontSize: 12, fill: F(T.muted) });
  text(meta, "master", { fontSize: 12, fontWeight: 500, fill: F(T.body) });
  if (options.primary) button(row, options.primary, { kind: "primary", height: 44, icon: options.primaryIcon });
  return row;
}

function projectTabs(parent, active) {
  const wrap = frame(parent, { name: "Project navigation", width: "fill_container", height: 48, layout: "vertical", gap: 0 });
  const tabs = frame(wrap, { width: "fill_container", height: 47, layout: "horizontal", gap: 34, alignItems: "end" });
  for (const label of ["项目信息", "发布", "项目配置", "域名与入口", "部署记录"]) {
    const selected = label === active;
    const tab = frame(tabs, { name: `Tab: ${label}`, role: "nav-link", width: "fit_content", height: 47, layout: "vertical", gap: 11, justifyContent: "end", alignItems: "center" });
    text(tab, label, { fontSize: 14, fontWeight: selected ? 600 : 500, fill: F(selected ? T.blue : T.body) });
    frame(tab, { width: "fill_container", height: 2, cornerRadius: 1, fill: F(selected ? T.blue : T.bg) });
  }
  divider(wrap);
  return wrap;
}

function configRail(parent) {
  const rail = frame(parent, { name: "Configuration navigation", width: 160, height: "fill_container", layout: "vertical", gap: 4, padding: [0, 14, 0, 0], stroke: S(T.line) });
  const items = [["box", "版本"], ["target", "部署目标"], ["link", "资源绑定"], ["lock-keyhole", "变量与密钥"], ["users", "访问权限"], ["heart-pulse", "验证与监控"]];
  for (const [glyph, label] of items) {
    const selected = label === "版本";
    const item = frame(rail, { name: `Configuration: ${label}`, role: "nav-link", width: "fill_container", height: 42, layout: "horizontal", padding: [0, 12], gap: 10, alignItems: "center", cornerRadius: 6, fill: F(selected ? T.blue50 : T.bg) });
    if (selected) frame(item, { width: 3, height: 26, cornerRadius: 2, fill: F(T.blue) });
    icon(item, glyph, { width: 17, height: 17, fill: F(selected ? T.blue : T.muted) });
    text(item, label, { fontSize: 14, fontWeight: selected ? 600 : 500, fill: F(selected ? T.blue : T.body) });
  }
  return rail;
}
