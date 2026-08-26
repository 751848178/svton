function directoryToolbar(parent) {
  const toolbar = frame(parent, { width: "fill_container", height: 56, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const filters = frame(toolbar, { width: "fit_content", height: 42, layout: "horizontal", gap: 10, alignItems: "center" });
  const search = frame(filters, { name: "Search projects", role: "search-bar", width: 340, height: 40, layout: "horizontal", padding: [0, 12], gap: 8, alignItems: "center", cornerRadius: 6, fill: F(T.bg), stroke: S(T.lineStrong) });
  icon(search, "search", { width: 17, height: 17, fill: F(T.muted) });
  text(search, "搜索项目名称、仓库或域名", { fontSize: 13, fill: F(T.muted) });
  const state = frame(filters, { name: "Filter by status", role: "button", width: 122, height: 40, layout: "horizontal", padding: [0, 12], alignItems: "center", justifyContent: "space_between", cornerRadius: 6, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(state, "全部状态", { fontSize: 13, fontWeight: 500, fill: F(T.body) });
  icon(state, "chevron-down", { width: 15, height: 15, fill: F(T.muted) });
  text(toolbar, "6 个项目 · 最近活动优先", { fontSize: 13, fill: F(T.muted) });
}

const PROJECT_ROWS = [
  { name: "Picshare", meta: "Monorepo · master", state: "在线", tone: "green", release: "图库重构 1.4.0", time: "08-25 16:42", issues: "0", actions: ["进入项目", "创建发布"] },
  { name: "Atlas Docs", meta: "Web · main", state: "待配置", tone: "orange", release: "—", time: "08-25 10:18", issues: "2 项", actions: ["配置生产", "进入项目"] },
  { name: "Storefront", meta: "Monorepo · main", state: "在线", tone: "green", release: "夏季活动 2.7.1", time: "08-24 21:03", issues: "0", actions: ["进入项目", "创建发布"] },
  { name: "Ops Console", meta: "Web · release", state: "预发中", tone: "blue", release: "权限收敛 0.9.8", time: "08-24 18:27", issues: "1 项", actions: ["查看发布", "进入项目"] },
  { name: "Design Assets", meta: "Static · main", state: "已暂停", tone: "orange", release: "资源迁移 1.2.0", time: "08-21 09:12", issues: "0", actions: ["进入项目", "恢复发布"] },
  { name: "Mobile Service", meta: "Service · main", state: "在线", tone: "green", release: "会话更新 3.3.4", time: "08-20 15:36", issues: "0", actions: ["进入项目", "创建发布"] },
];

function projectTable(parent) {
  const table = frame(parent, { name: "Project directory table", role: "table", width: "fill_container", height: 404, layout: "vertical", cornerRadius: 8, clipContent: true, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [260, 110, 190, 160, 120, 268];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 16], alignItems: "center", fill: F(T.surface) });
  ["项目", "状态", "最近发布", "最近活动", "问题", "操作"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  for (const project of PROJECT_ROWS) {
    const row = frame(table, { name: `Project: ${project.name}`, role: "table-row", width: "fill_container", height: 59, layout: "horizontal", padding: [0, 16], alignItems: "center", fill: F(T.bg), stroke: S(T.line) });
    const identity = cell(row, widths[0]);
    const projectMark = frame(identity, { width: 32, height: 32, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 7, fill: F(T.blue50) });
    icon(projectMark, "folder", { width: 17, height: 17, fill: F(T.blue) });
    const copy = frame(identity, { width: 194, height: "fit_content", layout: "vertical", gap: 2 });
    text(copy, project.name, { fontSize: 14, fontWeight: 600, fill: F(T.ink) });
    text(copy, project.meta, { fontSize: 12, fill: F(T.muted) });
    const stateCell = cell(row, widths[1]);
    status(stateCell, project.state, project.tone);
    cell(row, widths[2], project.release, { fontSize: 13, fontWeight: project.release === "—" ? 400 : 500, color: project.release === "—" ? T.faint : T.body });
    cell(row, widths[3], project.time, { fontSize: 13, color: T.muted });
    const issueCell = cell(row, widths[4]);
    if (project.issues === "0") text(issueCell, "无", { fontSize: 13, fill: F(T.muted) });
    else {
      icon(issueCell, "circle-alert", { width: 15, height: 15, fill: F(T.orange) });
      text(issueCell, project.issues, { fontSize: 13, fontWeight: 600, fill: F(T.orange) });
    }
    const actions = cell(row, widths[5]);
    for (const label of project.actions) textAction(actions, label);
    iconAction(actions, "ellipsis", `${project.name} 更多操作`);
  }
  return table;
}

function buildDirectory() {
  const { main } = createScreen("V2-01 Project Directory", 0);
  const content = frame(main, { width: "fill_container", height: "fill_container", layout: "vertical", padding: [28, 32], gap: 18 });
  const titleRow = frame(content, { width: "fill_container", height: 64, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const title = frame(titleRow, { width: 650, height: "fit_content", layout: "vertical", gap: 5 });
  text(title, "我的项目", { fontSize: 26, fontWeight: 700, fill: F(T.ink) });
  text(title, "查看项目的发布状态、最新版本与需要处理的问题。", { fontSize: 14, fill: F(T.muted) });
  button(titleRow, "创建项目", { kind: "primary", icon: "plus" });
  const summary = frame(content, { width: "fill_container", height: 38, layout: "horizontal", gap: 26, alignItems: "center" });
  text(summary, "6 个项目", { fontSize: 14, fontWeight: 600, fill: F(T.ink) });
  text(summary, "4 个正常运行", { fontSize: 14, fill: F(T.green) });
  text(summary, "2 个需要处理", { fontSize: 14, fill: F(T.orange) });
  divider(content);
  directoryToolbar(content);
  projectTable(content);
}
