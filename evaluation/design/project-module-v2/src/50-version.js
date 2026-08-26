const VERSION_ROWS = [
  { version: "1.4.0", name: "图库重构", source: "master @ a1b2c3d", change: "组件 2 · 配置 3", time: "08-20 08:31", state: "运行中", selected: false },
  { version: "1.3.2", name: "稳定版", source: "release/1.3 @ 8f7e6d5", change: "组件 1 · 配置 2", time: "08-10 14:22", state: "已通过", selected: true },
  { version: "1.3.1", name: "登录修复", source: "hotfix/login @ 3c2b1a0", change: "组件 1 · 配置 1", time: "08-03 11:09", state: "已通过", selected: false },
];

function currentVersion(parent) {
  const card = frame(parent, { name: "Current version summary", width: "fill_container", height: 102, layout: "horizontal", padding: [16, 18], alignItems: "center", justifyContent: "space_between", cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const fields = [["当前版本", "1.4.0  图库重构"], ["状态", "运行中"], ["来源", "master  @  a1b2c3d"], ["创建时间", "2026-08-20 08:31"]];
  const widths = [190, 120, 190, 170];
  fields.forEach(([label, value], index) => {
    const field = frame(card, { width: widths[index], height: "fit_content", layout: "vertical", gap: 8 });
    text(field, label, { fontSize: 12, fontWeight: 500, fill: F(T.muted) });
    if (index === 1) {
      const running = frame(field, { width: "fit_content", height: 22, layout: "horizontal", gap: 7, alignItems: "center" });
      I(running, { type: "ellipse", width: 7, height: 7, fill: F(T.green) });
      text(running, value, { fontSize: 13, fontWeight: 600, fill: F(T.green) });
    } else text(field, value, { fontSize: index === 0 ? 17 : 13, fontWeight: index === 0 ? 700 : 500, fill: F(index === 0 ? T.blue : T.ink) });
  });
}

function versionsTable(parent) {
  const table = frame(parent, { name: "Existing versions table", role: "table", width: "fill_container", height: 218, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [100, 135, 90, 90, 70, 198];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 44, layout: "horizontal", padding: [0, 12], alignItems: "center", fill: F(T.surface) });
  ["版本", "变更来源", "配置变更", "创建时间", "状态", "操作"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  for (const version of VERSION_ROWS) {
    const row = frame(table, { name: `Version ${version.version}${version.selected ? " — selected" : ""}`, role: "table-row", width: "fill_container", height: 58, layout: "horizontal", padding: [0, 12], alignItems: "center", fill: F(version.selected ? T.blue50 : T.bg), stroke: S(T.line) });
    const versionCell = cell(row, widths[0]);
    if (version.selected) I(versionCell, { type: "ellipse", width: 8, height: 8, fill: F(T.blue) });
    const versionCopy = frame(versionCell, { width: 88, height: "fit_content", layout: "vertical", gap: 1 });
    text(versionCopy, version.version, { fontSize: 13, fontWeight: 700, fill: F(T.blue) });
    text(versionCopy, version.name, { fontSize: 12, fontWeight: 500, fill: F(T.body) });
    const sourceCell = cell(row, widths[1]);
    const [branch, commit] = version.source.split(" @ ");
    const sourceCopy = frame(sourceCell, { width: 150, height: "fit_content", layout: "vertical", gap: 1 });
    text(sourceCopy, branch, { fontSize: 12, fontWeight: 500, fill: F(T.body) });
    text(sourceCopy, commit, { fontSize: 12, fill: F(T.blue) });
    cell(row, widths[2], version.change.replaceAll(" ", ""), { fontSize: 13, color: T.body });
    cell(row, widths[3], version.time, { fontSize: 12, color: T.muted });
    const stateCell = cell(row, widths[4]);
    icon(stateCell, "circle-check", { width: 15, height: 15, fill: F(T.green) });
    text(stateCell, version.state, { fontSize: 12, fontWeight: 600, fill: F(T.green) });
    const actions = cell(row, widths[5]);
    for (const label of version.selected ? ["详情", "变更", "切换"] : ["详情", "变更", "证据"]) textAction(actions, label);
    iconAction(actions, "ellipsis", `${version.version} 更多操作`);
  }
}

function versionInspector(parent) {
  const pane = frame(parent, { name: "Selected version details", width: 220, height: "fill_container", layout: "vertical", padding: [4, 0, 0, 20], gap: 15, stroke: S(T.line) });
  text(pane, "版本详情", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  const hero = frame(pane, { width: "fill_container", height: 52, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(hero, "1.3.2", { fontSize: 21, fontWeight: 700, fill: F(T.ink) });
  const passed = frame(hero, { width: "fit_content", height: 28, layout: "horizontal", gap: 5, alignItems: "center" });
  icon(passed, "circle-check", { width: 15, height: 15, fill: F(T.green) });
  text(passed, "已通过", { fontSize: 12, fontWeight: 600, fill: F(T.green) });
  divider(pane);
  text(pane, "配置变更概览", { fontSize: 12, fontWeight: 600, fill: F(T.muted) });
  for (const [glyph, label, count] of [["box", "组件变更", "1 个"], ["sliders-horizontal", "配置变更", "2 项"]]) {
    const item = frame(pane, { width: "fill_container", height: 34, layout: "horizontal", gap: 9, alignItems: "center" });
    icon(item, glyph, { width: 16, height: 16, fill: F(T.ink) });
    text(item, label, { width: 118, textGrowth: "fixed-width", fontSize: 13, fill: F(T.body) });
    text(item, count, { fontSize: 13, fontWeight: 500, fill: F(T.body) });
  }
  divider(pane);
  const fields = [["变更来源", "release/1.3 @ 8f7e6d5"], ["创建时间", "2026-08-10 14:22"], ["变更说明", "修复公开入口问题并优化图片处理"]];
  for (const [label, value] of fields) {
    const field = frame(pane, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 6 });
    text(field, label, { fontSize: 12, fontWeight: 500, fill: F(T.muted) });
    text(field, value, { width: 196, textGrowth: "fixed-width", fontSize: 12, lineHeight: 1.55, fill: F(T.body) });
  }
  divider(pane);
  textAction(pane, "查看技术证据", { arrow: true });
}

function buildVersionConfiguration() {
  const { main } = createScreen("V2-02 Version Configuration", 1520);
  const content = frame(main, { width: "fill_container", height: "fill_container", layout: "vertical", padding: [20, 28], gap: 10 });
  projectTitle(content, { primary: "创建发布", primaryIcon: "plus" });
  projectTabs(content, "项目配置");
  const issue = frame(content, { name: "Production entry issue", width: "fill_container", height: 44, layout: "horizontal", padding: [0, 12], gap: 10, alignItems: "center", cornerRadius: 6, fill: F(T.orange50), stroke: S("#FED7AA") });
  icon(issue, "triangle-alert", { width: 17, height: 17, fill: F(T.orange) });
  text(issue, "生产环境缺少入口，完成配置后才能发布。", { fontSize: 13, fontWeight: 500, fill: F(T.body) });
  textAction(issue, "配置生产入口", { arrow: true });
  const workbench = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 12, padding: [10, 0, 0, 0] });
  configRail(workbench);
  const center = frame(workbench, { name: "Version configuration", width: 714, height: "fill_container", layout: "vertical", gap: 12 });
  const titleRow = frame(center, { width: "fill_container", height: 48, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const title = frame(titleRow, { width: 380, height: "fit_content", layout: "vertical", gap: 4 });
  text(title, "版本配置", { fontSize: 21, fontWeight: 700, fill: F(T.ink) });
  text(title, "切换后创建一次受审计的部署操作，不会直接覆盖运行状态。", { fontSize: 12, fill: F(T.muted) });
  const environment = frame(titleRow, { width: 230, height: 40, layout: "horizontal", gap: 10, alignItems: "center", justifyContent: "end" });
  text(environment, "当前环境", { fontSize: 12, fontWeight: 500, fill: F(T.muted) });
  const select = frame(environment, { name: "Environment selector", role: "button", width: 154, height: 38, layout: "horizontal", padding: [0, 11], alignItems: "center", justifyContent: "space_between", cornerRadius: 6, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(select, "生产环境", { fontSize: 13, fontWeight: 500, fill: F(T.ink) });
  icon(select, "chevron-down", { width: 15, height: 15, fill: F(T.muted) });
  currentVersion(center);
  text(center, "已有版本", { fontSize: 15, fontWeight: 700, fill: F(T.ink) });
  versionsTable(center);
  versionInspector(workbench);
}
