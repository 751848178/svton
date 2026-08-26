const STAGING_EVENTS = [
  ["10:49:12", "准备目标", "已完成", "预发环境资源检查通过"],
  ["10:50:03", "拉取制品", "已完成", "picshare-web 86.4 MB 校验一致"],
  ["10:50:41", "启动组件", "已完成", "新实例已进入健康检查"],
  ["10:51:16", "健康检查", "进行中", "2 / 3 个实例已就绪"],
  ["—", "入口验证", "等待中", "将在全部实例就绪后开始"],
];

function stagingEventsTable(parent) {
  const table = frame(parent, { name: "Live staging events", role: "table", width: "fill_container", height: 326, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [90, 130, 112, 400];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.surface) });
  ["时间", "事件", "状态", "说明"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  for (const event of STAGING_EVENTS) {
    const active = event[2] === "进行中";
    const row = frame(table, { role: "table-row", width: "fill_container", height: 56, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(active ? T.blue50 : T.bg), stroke: S(T.line) });
    cell(row, widths[0], event[0], { fontSize: 12, color: T.muted });
    cell(row, widths[1], event[1], { fontSize: 13, fontWeight: 600, color: T.ink });
    const stateCell = cell(row, widths[2]);
    if (active) {
      icon(stateCell, "loader-circle", { width: 15, height: 15, fill: F(T.blue) });
      text(stateCell, event[2], { fontSize: 13, fontWeight: 600, fill: F(T.blue) });
    } else if (event[2] === "已完成") {
      icon(stateCell, "circle-check", { width: 15, height: 15, fill: F(T.green) });
      text(stateCell, event[2], { fontSize: 13, fontWeight: 600, fill: F(T.green) });
    } else text(stateCell, event[2], { fontSize: 13, fontWeight: 500, fill: F(T.faint) });
    cell(row, widths[3], event[3], { fontSize: 12, color: active ? T.body : T.muted });
  }
}

function stagingLogSummary(parent) {
  const panel = frame(parent, { name: "Staging log summary", width: "fill_container", height: 350, layout: "vertical", padding: 16, gap: 12, cornerRadius: 7, fill: F("#111827") });
  const head = frame(panel, { width: "fill_container", height: 32, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(head, "实时日志摘要", { fontSize: 14, fontWeight: 700, fill: F(T.bg) });
  const live = frame(head, { width: "fit_content", height: 26, layout: "horizontal", gap: 6, alignItems: "center" });
  I(live, { type: "ellipse", width: 7, height: 7, fill: F("#22C55E") });
  text(live, "持续更新", { fontSize: 12, fontWeight: 600, fill: F("#86EFAC") });
  const logs = [
    ["10:50:41", "picshare-web 实例启动完成"],
    ["10:50:56", "实例 1 健康检查通过"],
    ["10:51:04", "实例 2 健康检查通过"],
    ["10:51:16", "等待实例 3 返回就绪状态"],
  ];
  for (const [time, message] of logs) {
    const line = frame(panel, { width: "fill_container", height: 42, layout: "horizontal", gap: 10, alignItems: "center", stroke: S("#263244") });
    text(line, time, { width: 70, textGrowth: "fixed-width", fontSize: 12, fill: F("#94A3B8") });
    text(line, message, { width: 250, textGrowth: "fixed-width", fontSize: 12, fill: F("#E5E7EB") });
  }
  const note = frame(panel, { width: "fill_container", height: 48, layout: "horizontal", padding: [0, 10], gap: 8, alignItems: "center", cornerRadius: 6, fill: F("#1E293B") });
  icon(note, "info", { width: 16, height: 16, fill: F("#60A5FA") });
  text(note, "最近 4 条关键事件；完整日志按日志策略保留。", { fontSize: 12, fill: F("#CBD5E1") });
}

function buildStagingDeploymentRunning() {
  const { content } = createProjectMoment("V2-06 Staging Deployment Running", 7600, { tab: "发布" });
  momentHeading(content, {
    title: "Picshare R1 · 预发部署",
    status: "进行中",
    tone: "blue",
    description: "候选制品正在部署到预发环境，完成后自动开始预发验证。",
    primary: "打开实时日志",
    primaryIcon: "scroll-text",
  });
  releaseProgress(content, [["构建", "done"], ["预发部署", "active"], ["预发验证", "pending"], ["生产发布", "pending"]]);
  releaseFacts(content, [
    ["候选版本", `${CANDIDATE_RELEASE.name} ${CANDIDATE_RELEASE.version}`],
    ["来源", CANDIDATE_RELEASE.source],
    ["制品", CANDIDATE_RELEASE.artifact],
    ["开始时间", "2026-08-26 10:49"],
  ]);
  const lower = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 18, padding: [4, 0, 0, 0] });
  const events = frame(lower, { width: 760, height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(events, "实时事件", "自动刷新");
  stagingEventsTable(events);
  const logs = frame(lower, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(logs, "日志摘要", "最近关键事件");
  stagingLogSummary(logs);
}
