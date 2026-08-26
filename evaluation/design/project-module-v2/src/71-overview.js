function overviewReleaseTable(parent) {
  const table = frame(parent, { name: "Recent releases table", role: "table", width: "fill_container", height: 220, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [170, 126, 132, 170];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.surface) });
  ["发布", "环境", "结果", "完成时间"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  const rows = [
    ["图库重构 1.4.0", "生产环境", "已完成", "08-20 09:06"],
    ["登录修复 1.3.1", "生产环境", "已完成", "08-03 11:42"],
    ["缩略图优化 1.3.0", "预发环境", "已完成", "07-28 16:18"],
  ];
  for (const rowData of rows) {
    const row = frame(table, { role: "table-row", width: "fill_container", height: 58, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.bg), stroke: S(T.line) });
    rowData.forEach((value, index) => {
      const target = cell(row, widths[index]);
      if (index === 2) {
        icon(target, "circle-check", { width: 15, height: 15, fill: F(T.green) });
        text(target, value, { fontSize: 13, fontWeight: 600, fill: F(T.green) });
      } else text(target, value, { fontSize: 13, fontWeight: index === 0 ? 600 : 400, fill: F(index === 3 ? T.muted : T.body) });
    });
  }
}

function overviewComponents(parent) {
  const table = frame(parent, { name: "Project components table", role: "table", width: "fill_container", height: 220, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.surface) });
  cell(head, 210, "组件", { fontSize: 12, fontWeight: 600, color: T.muted });
  cell(head, 126, "生产状态", { fontSize: 12, fontWeight: 600, color: T.muted });
  const rows = [["picshare-web", "在线"], ["image-worker", "在线"], ["media-storage", "已连接"]];
  for (const [name, stateLabel] of rows) {
    const row = frame(table, { role: "table-row", width: "fill_container", height: 58, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.bg), stroke: S(T.line) });
    const identity = cell(row, 210);
    icon(identity, name === "media-storage" ? "database" : "box", { width: 17, height: 17, fill: F(T.blue) });
    text(identity, name, { fontSize: 13, fontWeight: 600, fill: F(T.ink) });
    const stateCell = cell(row, 126);
    status(stateCell, stateLabel, "green");
  }
}

function buildProjectOverview() {
  const { content } = createProjectMoment("V2-04 Project Overview", 4560, { tab: "项目信息", primary: "创建发布", primaryIcon: "plus" });
  momentHeading(content, {
    title: "项目概览",
    description: "聚合当前生产版本、最近发布、运行组件与唯一需要处理的问题。",
    meta: "最近同步  2026-08-26 10:43",
  });
  sectionHeading(content, "当前生产", "Production");
  releaseFacts(content, [
    ["运行版本", `${CURRENT_RELEASE.name} ${CURRENT_RELEASE.version}`],
    ["来源", CURRENT_RELEASE.source],
    ["上线时间", "2026-08-20 09:06"],
    ["运行组件", "3 个 · 全部健康", T.green],
  ]);
  const blocker = frame(content, { name: "Only project blocker", width: "fill_container", height: 62, layout: "horizontal", padding: [0, 14], alignItems: "center", justifyContent: "space_between", cornerRadius: 7, fill: F(T.orange50), stroke: S("#FED7AA") });
  const message = frame(blocker, { width: 820, height: "fit_content", layout: "horizontal", gap: 10, alignItems: "center" });
  icon(message, "triangle-alert", { width: 18, height: 18, fill: F(T.orange) });
  const copy = frame(message, { width: 760, height: "fit_content", layout: "vertical", gap: 3 });
  text(copy, "生产环境缺少公开入口", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  text(copy, "影响：下一次生产发布无法接收外部流量。", { fontSize: 12, fill: F(T.body) });
  textAction(blocker, "配置生产入口", { arrow: true });
  const columns = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 18, padding: [4, 0, 0, 0] });
  const recent = frame(columns, { width: 690, height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(recent, "最近发布", "最近 30 天");
  overviewReleaseTable(recent);
  const components = frame(columns, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(components, "组件", "3 个");
  overviewComponents(components);
}
