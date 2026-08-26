const VERSION_ROWS = [
  { version: "1.4.0", name: "图库重构", source: "master @ a1b2c3d", time: "2026-08-20 08:31", state: "当前部署", current: true },
  { version: "1.3.2", name: "稳定版", source: "release/1.3 @ 8f7e6d5", time: "2026-08-10 14:22", state: "可切换", selected: true },
  { version: "1.3.1", name: "登录修复", source: "hotfix/login @ 3c2b1a0", time: "2026-08-03 11:09", state: "可切换" },
];

function currentVersion(parent) {
  const card = frame(parent, { name: "Current version summary", width: "fill_container", height: 106, layout: "horizontal", padding: [16, 18], alignItems: "center", cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const fields = [
    ["当前版本", "1.4.0", "图库重构", 190],
    ["提交", "a1b2c3d", "", 180],
    ["状态", "当前部署", "", 120],
    ["生效时间", "2026-08-20 09:06", "", 180],
  ];
  fields.forEach(([label, value, detail, width], index) => {
    const field = frame(card, { width, height: "fill_container", layout: "vertical", gap: 6, justifyContent: "center", padding: index === 0 ? [0, 10, 0, 0] : [0, 10, 0, 16], stroke: index === 0 ? undefined : S(T.line) });
    text(field, label, { fontSize: 12, fontWeight: 500, fill: F(T.muted) });
    text(field, value, { fontSize: index === 0 ? 18 : 13, fontWeight: 700, fill: F(index === 0 ? T.blue : index === 2 ? T.green : T.ink) });
    if (detail) text(field, detail, { fontSize: 12, fontWeight: 500, fill: F(T.body) });
  });
}

function disabledVersionAction(parent, label) {
  const node = frame(parent, { name: `Disabled action: ${label} — 已是当前部署`, role: "button", width: 70, height: 44, layout: "vertical", gap: 1, alignItems: "center", justifyContent: "center", opacity: 0.62 });
  text(node, label, { fontSize: 13, fontWeight: 500, fill: F(T.muted) });
  text(node, "已是当前部署", { fontSize: 10, fontWeight: 500, fill: F(T.muted) });
}

function versionRowActions(parent, version) {
  textAction(parent, "查看详情");
  textAction(parent, "查看变更");
  if (version.current) disabledVersionAction(parent, "切换版本");
  else textAction(parent, "切换版本");
  iconAction(parent, "ellipsis", `${version.version} 更多操作：查看技术证据`);
}

function versionsTable(parent) {
  const table = frame(parent, { name: "Switchable versions table", role: "table", width: "fill_container", height: 218, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [92, 140, 146, 100, 244];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 44, layout: "horizontal", padding: [0, 12], alignItems: "center", fill: F(T.surface) });
  ["版本", "来源", "制品创建时间", "状态", "操作"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  for (const version of VERSION_ROWS) {
    const row = frame(table, { name: `Version ${version.version}${version.selected ? " — selected" : ""}`, role: "table-row", width: "fill_container", height: 58, layout: "horizontal", padding: [0, 12], alignItems: "center", fill: F(version.selected ? T.blue50 : T.bg), stroke: S(T.line) });
    const versionCell = cell(row, widths[0]);
    const versionCopy = frame(versionCell, { width: 92, height: "fit_content", layout: "vertical", gap: 1 });
    text(versionCopy, version.version, { fontSize: 13, fontWeight: 700, fill: F(T.blue) });
    text(versionCopy, version.name, { fontSize: 12, fill: F(T.body) });
    const sourceCell = cell(row, widths[1]);
    const [branch, commit] = version.source.split(" @ ");
    const sourceCopy = frame(sourceCell, { width: 146, height: "fit_content", layout: "vertical", gap: 1 });
    text(sourceCopy, branch, { fontSize: 12, fontWeight: 500, fill: F(T.body) });
    text(sourceCopy, commit, { fontSize: 12, fontFamily: "Roboto Mono", fill: F(T.blue) });
    cell(row, widths[2], version.time, { fontSize: 12, color: T.muted });
    const stateCell = cell(row, widths[3]);
    icon(stateCell, version.current ? "circle-check" : "circle-dot", { width: 15, height: 15, fill: F(version.current ? T.green : T.blue) });
    text(stateCell, version.state, { fontSize: 12, fontWeight: 600, fill: F(version.current ? T.green : T.blue) });
    versionRowActions(cell(row, widths[4]), version);
  }
}

function inspectorField(parent, label, value) {
  const field = frame(parent, { width: "fill_container", height: 44, layout: "vertical", gap: 4 });
  text(field, label, { fontSize: 12, fontWeight: 500, fill: F(T.muted) });
  text(field, value, { width: 194, textGrowth: "fixed-width", fontSize: 12, fontWeight: 600, fill: F(T.body) });
}

function versionInspector(parent) {
  const pane = frame(parent, { name: "Selected version evidence", width: 218, height: "fill_container", layout: "vertical", padding: [4, 0, 0, 18], gap: 12, stroke: S(T.line) });
  text(pane, "版本详情", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  const hero = frame(pane, { width: "fill_container", height: 48, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const heroCopy = frame(hero, { width: 110, height: "fit_content", layout: "vertical", gap: 1 });
  text(heroCopy, "稳定版", { fontSize: 12, fill: F(T.muted) });
  text(heroCopy, "1.3.2", { fontSize: 21, fontWeight: 700, fill: F(T.ink) });
  text(hero, "可切换", { fontSize: 12, fontWeight: 600, fill: F(T.blue) });
  divider(pane);
  inspectorField(pane, "构建修订", "Build R18");
  inspectorField(pane, "预发部署证据", "2 条");
  inspectorField(pane, "生产资格", "审批已通过 · 尚未执行");
  inspectorField(pane, "来源", "release/1.3 @ 8f7e6d5");
  inspectorField(pane, "制品创建时间", "2026-08-10 14:22");
  inspectorField(pane, "状态", "可切换");
  const empty = frame(pane, { name: "No component or config changes", width: "fill_container", height: 82, layout: "vertical", padding: 12, gap: 5, cornerRadius: 6, fill: F(T.surface), stroke: S(T.line) });
  text(empty, "没有变更明细", { fontSize: 12, fontWeight: 700, fill: F(T.ink) });
  text(empty, "该版本没有记录组件/配置变更明细，请以变更来源分支与提交为准。", { width: 172, textGrowth: "fixed-width", fontSize: 12, lineHeight: 1.5, fill: F(T.muted) });
  const disclosure = frame(pane, { name: "Technical IDs — collapsed", role: "button", width: "fill_container", height: 50, layout: "horizontal", alignItems: "center", justifyContent: "space_between", padding: [0, 10], cornerRadius: 6, fill: F(T.bg), stroke: S(T.line) });
  const disclosureCopy = frame(disclosure, { width: 148, height: "fit_content", layout: "vertical", gap: 2 });
  text(disclosureCopy, "技术标识", { fontSize: 12, fontWeight: 600, fill: F(T.ink) });
  text(disclosureCopy, "默认收起", { fontSize: 11, fill: F(T.muted) });
  icon(disclosure, "chevron-down", { width: 15, height: 15, fill: F(T.muted) });
}

function buildVersionConfiguration() {
  const { main } = createScreen("V2-02 Version Configuration", 1520);
  const content = frame(main, { width: "fill_container", height: "fill_container", layout: "vertical", padding: [20, 28], gap: 10 });
  projectTitle(content, { primary: "创建发布", primaryIcon: "plus" });
  projectTabs(content, "项目配置");
  const issue = frame(content, { name: "Production entry evidence issue", width: "fill_container", height: 44, layout: "horizontal", padding: [0, 12], gap: 10, alignItems: "center", cornerRadius: 6, fill: F(T.orange50), stroke: S("#FED7AA") });
  icon(issue, "triangle-alert", { width: 17, height: 17, fill: F(T.orange) });
  text(issue, "生产入口已配置，DNS/TLS 真实探测证据尚未就绪。", { fontSize: 13, fontWeight: 500, fill: F(T.body) });
  textAction(issue, "查看生产入口", { arrow: true });
  const workbench = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 12, padding: [10, 0, 0, 0] });
  configRail(workbench);
  const center = frame(workbench, { name: "Version configuration", width: 746, height: "fill_container", layout: "vertical", gap: 12 });
  const titleRow = frame(center, { width: "fill_container", height: 40, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(titleRow, "版本配置", { fontSize: 21, fontWeight: 700, fill: F(T.ink) });
  const environment = frame(titleRow, { width: 230, height: 40, layout: "horizontal", gap: 10, alignItems: "center", justifyContent: "end" });
  text(environment, "当前环境", { fontSize: 12, fontWeight: 500, fill: F(T.muted) });
  const select = frame(environment, { name: "Environment selector", role: "button", width: 154, height: 38, layout: "horizontal", padding: [0, 11], alignItems: "center", justifyContent: "space_between", cornerRadius: 6, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(select, "生产环境", { fontSize: 13, fontWeight: 500, fill: F(T.ink) });
  icon(select, "chevron-down", { width: 15, height: 15, fill: F(T.muted) });
  text(center, "只能从已创建并通过相应发布校验的版本中切换；切换会创建一次受审计的部署，不会直接覆盖运行状态。", { width: 746, textGrowth: "fixed-width", fontSize: 12, lineHeight: 1.45, fill: F(T.muted) });
  currentVersion(center);
  text(center, "可切换版本", { fontSize: 15, fontWeight: 700, fill: F(T.ink) });
  versionsTable(center);
  versionInspector(workbench);
}
