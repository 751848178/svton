const STAGING_EVENTS = [
  ["2026-08-26 10:49", "部署运行已创建", "completed", "DeploymentRun 已创建并开始执行"],
  ["运行中", "执行器运行中", "current", "正在执行已冻结的预发部署计划"],
  ["—", "结果与证据", "disabled", "执行完成后写入技术结果与受控日志"],
];

function stagingEventsTimeline(parent) {
  const timeline = frame(parent, { name: "Staging run progress", role: "list", width: "fill_container", height: 326, layout: "vertical", padding: [16, 0], fill: F(T.bg) });
  STAGING_EVENTS.forEach(([time, label, state, detail], index) => {
    const style = progressStyle(state);
    const nextStyle = progressStyle(STAGING_EVENTS[index + 1]?.[2] || state);
    const row = frame(timeline, { name: `Staging run state: ${label} — ${state}`, role: "list-item", width: "fill_container", height: 94, layout: "horizontal", padding: [0, 10], gap: 12, alignItems: "center" });
    const marker = frame(row, { width: 28, height: 94, layout: "none" });
    if (index > 0) frame(marker, { x: 13, y: 0, width: 2, height: 47, fill: F(style.line) });
    if (index < STAGING_EVENTS.length - 1) frame(marker, { x: 13, y: 47, width: 2, height: 47, fill: F(nextStyle.line) });
    const node = frame(marker, { x: 3, y: 36, width: 22, height: 22, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 11, fill: F(style.fill), stroke: S(style.stroke, state === "current" ? 2 : 1) });
    if (state === "completed") icon(node, "check", { width: 12, height: 12, fill: F(T.blue700) });
    else I(node, { type: "ellipse", width: state === "current" ? 7 : 5, height: state === "current" ? 7 : 5, fill: F(state === "current" ? T.bg : style.text) });
    text(row, time, { width: 138, textGrowth: "fixed-width", fontFamily: "Roboto Mono", fontSize: 12, fill: F(state === "disabled" ? T.faint : T.muted) });
    const copy = frame(row, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 3 });
    text(copy, label, { fontSize: 13, fontWeight: state === "current" ? 700 : 600, fill: F(state === "disabled" ? T.faint : T.ink) });
    text(copy, detail, { fontSize: 12, fill: F(state === "disabled" ? T.faint : T.muted) });
    const stateLabel = state === "completed" ? "已完成" : state === "current" ? "进行中" : "未启用";
    text(row, stateLabel, { width: 66, textGrowth: "fixed-width", textAlign: "right", fontSize: 12, fontWeight: 600, fill: F(style.text) });
  });
}

function stagingRunStatusSummary(parent) {
  const panel = frame(parent, { name: "Staging run status summary", width: "fill_container", height: 350, layout: "vertical", padding: 16, gap: 12, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const head = frame(panel, { width: "fill_container", height: 32, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(head, "运行状态摘要", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  const live = frame(head, { width: "fit_content", height: 26, layout: "horizontal", gap: 6, alignItems: "center" });
  I(live, { type: "ellipse", width: 7, height: 7, fill: F(T.blue) });
  text(live, "运行中", { fontSize: 12, fontWeight: 600, fill: F(T.blue) });
  const facts = [
    ["运行状态", "进行中"],
    ["运行对象", "预发 DeploymentRun"],
    ["结果与证据", "执行完成后写入"],
  ];
  for (const [label, value] of facts) {
    const line = frame(panel, { width: "fill_container", height: 48, layout: "horizontal", alignItems: "center", justifyContent: "space_between", stroke: S(T.line) });
    text(line, label, { fontSize: 12, fill: F(T.muted) });
    text(line, value, { fontSize: 12, fontWeight: 600, fill: F(value === "进行中" ? T.blue : T.body) });
  }
  const note = frame(panel, { width: "fill_container", height: 52, layout: "horizontal", padding: [0, 10], gap: 8, alignItems: "center", cornerRadius: 6, fill: F(T.surface) });
  icon(note, "info", { width: 16, height: 16, fill: F(T.blue) });
  text(note, "运行结束后写入受控日志与结果证据。", { fontSize: 12, fill: F(T.muted) });
}

function buildStagingDeploymentRunning() {
  const { content } = createProjectMoment("V2-06 Staging Deployment Running", 7600, { tab: "发布" });
  momentHeading(content, {
    title: "Picshare R1 · 预发部署",
    status: "进行中",
    tone: "blue",
    description: "已冻结的预发部署计划正在执行，完成后写入技术结果与受控日志。",
    primary: "查看运行详情",
    primaryIcon: "scroll-text",
  });
  releaseProgress(content, [["构建", "completed"], ["预发部署", "current"], ["预发验证", "disabled"], ["生产发布", "disabled"]]);
  releaseFacts(content, [
    ["候选版本", `${CANDIDATE_RELEASE.name} ${CANDIDATE_RELEASE.version}`],
    ["来源", CANDIDATE_RELEASE.source],
    ["制品", CANDIDATE_RELEASE.artifact],
    ["开始时间", "2026-08-26 10:49"],
  ]);
  const lower = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 18, padding: [4, 0, 0, 0] });
  const events = frame(lower, { width: 760, height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(events, "执行进度", "DeploymentRun · 运行中");
  stagingEventsTimeline(events);
  const logs = frame(lower, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(logs, "状态摘要", "由当前运行状态派生");
  stagingRunStatusSummary(logs);
}
