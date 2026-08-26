function drawBrand(parent) {
  const brand = frame(parent, { layout: "horizontal", width: 140, height: 40, gap: 10, alignItems: "center" });
  const mark = frame(brand, {
    name: "Devpilot geometric cube mark",
    width: 28,
    height: 28,
    layout: "none",
    clipContent: true,
  });
  text(brand, "Devpilot", { fontSize: 20, fontWeight: 700, fill: F(T.ink) });
  return brand;
}

function drawHeader(root) {
  const header = frame(root, {
    name: "Global header — selected direction 3",
    role: "navbar",
    width: "fill_container",
    height: 64,
    layout: "horizontal",
    padding: [0, 20],
    alignItems: "center",
    justifyContent: "space_between",
    fill: F(T.bg),
    stroke: S(T.line),
  });
  const left = frame(header, { width: 420, height: 64, layout: "horizontal", gap: 22, alignItems: "center" });
  drawBrand(left);
  const org = frame(left, { width: 142, height: 40, layout: "horizontal", gap: 9, alignItems: "center" });
  const orgMark = frame(org, { width: 28, height: 28, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 7, fill: F(T.surface) });
  icon(orgMark, "users", { width: 15, height: 15, fill: F(T.ink) });
  text(org, "Test Org", { fontSize: 14, fontWeight: 500, fill: F(T.ink) });
  icon(org, "chevron-down", { width: 15, height: 15, fill: F(T.muted) });

  const right = frame(header, { width: 500, height: 64, layout: "horizontal", gap: 6, alignItems: "center", justifyContent: "end" });
  const search = frame(right, {
    name: "Global search",
    role: "search-bar",
    width: 320,
    height: 38,
    layout: "horizontal",
    padding: [0, 12],
    gap: 9,
    alignItems: "center",
    cornerRadius: 7,
    fill: F(T.bg),
    stroke: S(T.lineStrong),
  });
  icon(search, "search", { width: 17, height: 17, fill: F(T.muted) });
  text(search, "搜索...", { width: 218, textGrowth: "fixed-width", fontSize: 13, fill: F(T.muted) });
  const shortcut = frame(search, { width: 43, height: 24, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 5, fill: F(T.shell) });
  text(shortcut, "⌘ K", { fontSize: 12, fontWeight: 600, fill: F(T.muted) });

  const bell = frame(right, { name: "Notifications", role: "icon-button", width: 44, height: 44, layout: "none", cornerRadius: 6 });
  icon(bell, "bell", { x: 13, y: 13, width: 18, height: 18, fill: F(T.ink) });
  I(bell, { type: "ellipse", name: "Unread notification", x: 27, y: 8, width: 7, height: 7, fill: F("#FF2D2D"), stroke: S(T.bg, 2) });
  const help = frame(right, { name: "Icon action: 帮助", role: "icon-button", width: 44, height: 44, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 6 });
  const helpRing = frame(help, { width: 19, height: 19, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 10, fill: F(T.bg), stroke: S(T.ink) });
  text(helpRing, "?", { fontSize: 12, fontWeight: 700, fill: F(T.ink) });
  const avatar = frame(right, { name: "Account: SY", role: "button", width: 38, height: 38, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 19, fill: F(T.shell) });
  text(avatar, "SY", { fontSize: 13, fontWeight: 700, fill: F(T.ink) });
  return header;
}

const NAV_GROUPS = [
  ["仪表盘", [["layout-dashboard", "仪表盘"]]],
  ["项目", [["folder", "我的项目"], ["folder-plus", "创建项目"], ["blocks", "应用服务"]]],
  ["基础设施", [["server", "服务器"], ["globe", "站点"], ["zap", "CDN 配置管理"]]],
  ["资源", [["1", "申请资源"], ["2", "我的资源实例"], ["3", "资源操作"], ["4", "资源连接（高级）"], ["5", "密码中心"]]],
  ["运维", [["activity", "监控告警"], ["scroll-text", "日志中心"]]],
];

function drawSidebar(parent) {
  const sidebar = frame(parent, {
    name: "Global navigation",
    width: 236,
    height: "fill_container",
    layout: "vertical",
    padding: [18, 14, 16, 14],
    justifyContent: "space_between",
    fill: F(T.shell),
    stroke: S(T.line),
  });
  const top = frame(sidebar, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 16 });
  const menuSearch = frame(top, { name: "Menu search", role: "search-bar", width: "fill_container", height: 38, layout: "horizontal", padding: [0, 12], gap: 8, alignItems: "center", cornerRadius: 6, fill: F(T.bg), stroke: S(T.lineStrong) });
  icon(menuSearch, "search", { width: 15, height: 15, fill: F(T.faint) });
  text(menuSearch, "搜索菜单", { fontSize: 13, fill: F(T.faint) });
  for (const [groupLabel, items] of NAV_GROUPS) {
    const group = frame(top, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 3 });
    text(group, groupLabel, { fontSize: 12, fontWeight: 600, fill: F(T.muted) });
    for (const [glyph, label] of items) {
      const active = label === "我的项目";
      const item = frame(group, { name: `Navigation: ${label}`, role: "nav-link", width: "fill_container", height: 36, layout: "horizontal", padding: [0, 10], gap: 10, alignItems: "center", cornerRadius: 6, fill: F(active ? T.blue50 : T.shell) });
      if (active) frame(item, { width: 3, height: 22, cornerRadius: 2, fill: F(T.blue) });
      if (/^[1-5]$/.test(glyph)) {
        const number = frame(item, { width: 16, height: 16, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 8, fill: F(T.shell), stroke: S(T.lineStrong) });
        text(number, glyph, { fontSize: 9, fontWeight: 600, fill: F(T.muted) });
      } else icon(item, glyph, { width: 16, height: 16, fill: F(active ? T.blue : T.muted) });
      text(item, label, { fontSize: 13, fontWeight: active ? 600 : 400, fill: F(active ? T.ink : T.body) });
    }
  }
  const profile = frame(sidebar, { name: "Current account", width: "fill_container", height: 64, layout: "horizontal", padding: 10, gap: 10, alignItems: "center", cornerRadius: 8, fill: F(T.bg), stroke: S(T.line) });
  const profileAvatar = frame(profile, { width: 36, height: 36, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 7, fill: F(T.shell) });
  text(profileAvatar, "SY", { fontSize: 12, fontWeight: 700, fill: F(T.ink) });
  const profileCopy = frame(profile, { width: 142, height: "fit_content", layout: "vertical", gap: 2 });
  text(profileCopy, "System Administrator", { fontSize: 12, fontWeight: 600, fill: F(T.ink) });
  text(profileCopy, "admin@devpilot.local", { fontSize: 11, fill: F(T.muted) });
  return sidebar;
}

function createScreen(name, x) {
  const root = frame(null, { name, x, y: 0, width: 1440, height: 1024, layout: "vertical", clipContent: true, fill: F(T.bg) });
  drawHeader(root);
  const body = frame(root, { width: "fill_container", height: "fill_container", layout: "horizontal", fill: F(T.bg) });
  drawSidebar(body);
  return { root, main: frame(body, { name: "Page content", width: "fill_container", height: "fill_container", layout: "vertical", fill: F(T.bg) }) };
}
