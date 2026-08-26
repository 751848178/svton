function directoryToolbar(parent) {
  const toolbar = frame(parent, { width: "fill_container", height: 56, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const filters = frame(toolbar, { width: "fit_content", height: 44, layout: "horizontal", gap: 10, alignItems: "center" });
  const search = frame(filters, { name: "Search projects", role: "search-bar", width: 340, height: 40, layout: "horizontal", padding: [0, 12], gap: 8, alignItems: "center", cornerRadius: 6, fill: F(T.bg), stroke: S(T.lineStrong) });
  icon(search, "search", { width: 17, height: 17, fill: F(T.muted) });
  text(search, "搜索项目名称、仓库或域名", { fontSize: 13, fill: F(T.muted) });
  const state = frame(filters, { name: "Filter by status", role: "button", width: 122, height: 40, layout: "horizontal", padding: [0, 12], alignItems: "center", justifyContent: "space_between", cornerRadius: 6, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(state, "全部状态", { fontSize: 13, fontWeight: 500, fill: F(T.body) });
  icon(state, "chevron-down", { width: 15, height: 15, fill: F(T.muted) });
  const order = frame(toolbar, { width: "fit_content", height: 44, layout: "horizontal", gap: 6, alignItems: "center" });
  text(order, "6 个项目 · 最近活动优先", { fontSize: 13, fill: F(T.muted) });
  textAction(order, "配置");
}

const PROJECT_TYPE_LABELS = {
  web_application: "Web 应用",
  backend_service: "后端服务",
  static_site: "静态站点",
  mixed_application: "混合应用",
};

const ARCHITECTURE_LABELS = { monorepo: "Monorepo", single_repository: "单仓库" };

const PROJECT_ROWS = [
  { name: "Picshare", intake: { projectType: "backend_service", architecture: "monorepo" }, state: "运行中", components: "web:3000 · worker:3001", version: "1.4.0", domain: "picshare.example.com", time: "2026-08-25 16:42" },
  { name: "Atlas Docs", intake: { projectType: "static_site", architecture: "single_repository" }, state: "待配置", components: "docs-web:3000", version: "—", domain: "—", time: "2026-08-25 10:18", nextAction: "补全生产变量" },
  { name: "Storefront", intake: { projectType: "mixed_application", architecture: "monorepo" }, state: "运行中", components: "web:3000 · api:3001", version: "2.7.1", domain: "shop.example.com", time: "2026-08-24 21:03" },
  { name: "Ops Console", intake: { projectType: "web_application", architecture: "single_repository" }, state: "待配置", components: "ops-web:3000", version: "0.9.8", domain: "ops.example.com", time: "2026-08-24 18:27", nextAction: "配置生产入口" },
  { name: "Design Assets", intake: { projectType: "static_site", architecture: "single_repository" }, state: "运行中", components: "assets-web:4173", version: "1.2.0", domain: "assets.example.com", time: "2026-08-21 09:12" },
  { name: "Mobile Service", intake: { projectType: "backend_service", architecture: "single_repository" }, state: "运行中", components: "mobile-api:3000", version: "3.3.4", domain: "api.example.com", time: "2026-08-20 15:36" },
];

function projectMeta(project) {
  return [PROJECT_TYPE_LABELS[project.intake?.projectType], ARCHITECTURE_LABELS[project.intake?.architecture]].filter(Boolean).join(" · ");
}

function directoryActions(parent, project) {
  const direct = project.nextAction ? [project.nextAction, "进入项目", "发布"] : ["进入项目", "发布", "项目配置"];
  for (const label of direct) textAction(parent, label);
  iconAction(parent, "ellipsis", `${project.name} 更多操作：${project.nextAction ? "项目配置、域名与入口" : "域名与入口"}`);
}

function projectTable(parent) {
  const table = frame(parent, { name: "Project directory table", role: "table", width: "fill_container", height: 404, layout: "vertical", cornerRadius: 8, clipContent: true, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [190, 76, 185, 200, 180, 277];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 16], alignItems: "center", fill: F(T.surface) });
  ["项目", "状态", "组件", "线上版本", "最新发布时间", "操作"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  for (const project of PROJECT_ROWS) {
    const row = frame(table, { name: `Project: ${project.name}`, role: "table-row", width: "fill_container", height: 59, layout: "horizontal", padding: [0, 16], alignItems: "center", fill: F(T.bg), stroke: S(T.line) });
    const identity = cell(row, widths[0]);
    const projectCopy = frame(identity, { width: 184, height: "fit_content", layout: "vertical", gap: 2 });
    text(projectCopy, project.name, { fontSize: 14, fontWeight: 400, fill: F(T.ink) });
    const meta = projectMeta(project);
    if (meta) text(projectCopy, meta, { fontSize: 12, fill: F(T.muted) });
    const stateCell = cell(row, widths[1]);
    text(stateCell, project.state, { fontSize: 13, fontWeight: 600, fill: F(project.state === "运行中" ? T.green : T.orange) });
    cell(row, widths[2], project.components, { fontSize: 12, fontWeight: 500, color: T.body, fontFamily: "Roboto Mono" });
    const versionCell = cell(row, widths[3]);
    const versionCopy = frame(versionCell, { width: 194, height: "fit_content", layout: "vertical", gap: 2 });
    text(versionCopy, project.version, { fontSize: 13, fontWeight: project.version === "—" ? 400 : 600, fill: F(project.version === "—" ? T.faint : T.ink) });
    text(versionCopy, `Production · ${project.domain}`, { fontSize: 12, fill: F(project.domain === "—" ? T.faint : T.muted) });
    cell(row, widths[4], project.time, { fontSize: 12, color: T.muted });
    directoryActions(cell(row, widths[5]), project);
  }
  return table;
}

function buildDirectory() {
  const { main } = createScreen("V2-01 Project Directory", 0);
  const content = frame(main, { width: "fill_container", height: "fill_container", layout: "vertical", padding: [28, 32], gap: 18 });
  const titleRow = frame(content, { width: "fill_container", height: 64, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const title = frame(titleRow, { width: 650, height: "fit_content", layout: "vertical", gap: 5 });
  text(title, "我的项目", { fontSize: 26, fontWeight: 700, fill: F(T.ink) });
  text(title, "查看项目的生产状态、运行组件和线上版本。", { fontSize: 14, fill: F(T.muted) });
  button(titleRow, "创建项目", { kind: "primary", icon: "plus" });
  const summary = frame(content, { width: "fill_container", height: 38, layout: "horizontal", gap: 8, alignItems: "center" });
  text(summary, "6 个项目", { fontSize: 14, fontWeight: 600, fill: F(T.ink) });
  text(summary, "·", { fontSize: 14, fill: F(T.faint) });
  text(summary, "4 运行中", { fontSize: 14, fontWeight: 600, fill: F(T.green) });
  text(summary, "·", { fontSize: 14, fill: F(T.faint) });
  text(summary, "2 待配置", { fontSize: 14, fontWeight: 600, fill: F(T.orange) });
  divider(content);
  directoryToolbar(content);
  projectTable(content);
}
