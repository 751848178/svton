const STAGING_EVENTS = [
  { title: "DeploymentRun 已创建", detail: "运行记录已持久化", metadata: "创建于 10:49", state: "completed" },
  { title: "部署运行进行中", detail: "按冻结的预发部署输入执行；终态前不展示日志", metadata: "running · 开始于 10:49", state: "current" },
  { title: "终态结果与证据", detail: "finishedAt 与 result 尚未产生", metadata: "等待终态", state: "future" },
];

function timelineButton(parent, label, disabled = false) {
  const node = frame(parent, { name: `${disabled ? "Disabled" : "Outline"} action: ${label}${disabled ? " — aria-disabled=true" : ""}`, role: "button", width: 144, height: 38, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 6, fill: F(disabled ? T.surface : T.bg), stroke: S(disabled ? T.line : T.lineStrong) });
  text(node, label, { fontSize: 13, fontWeight: 600, fill: F(disabled ? T.faint : T.body) });
  return node;
}

function timelineMarker(parent, state, height, index) {
  const marker = frame(parent, { width: 24, height, layout: "none" });
  const center = 28;
  if (index > 0) frame(marker, { x: 11, y: 0, width: 2, height: center, fill: F(index === 1 ? "#93C5FD" : "#D0D5DD") });
  if (index < STAGING_EVENTS.length - 1) frame(marker, { x: 11, y: center, width: 2, height: height - center, fill: F(index === 0 ? "#93C5FD" : "#D0D5DD") });
  const size = state === "current" ? 20 : 18;
  const node = frame(marker, { x: 12 - size / 2, y: center - size / 2, width: size, height: size, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: size / 2, fill: F(state === "current" ? "#0F62FE" : state === "completed" ? "#DBEAFE" : "#F8FAFC"), stroke: S(state === "current" ? "#0F62FE" : state === "completed" ? "#93C5FD" : "#D0D5DD") });
  if (state === "completed") icon(node, "check", { width: 11, height: 11, fill: F("#1D4ED8") });
  else if (state === "current") I(node, { type: "ellipse", width: 7, height: 7, fill: F(T.bg) });
  else icon(node, "minus", { width: 10, height: 10, fill: F("#98A2B3") });
}

function stagingEventsTimeline(parent) {
  const timeline = frame(parent, { name: "DeploymentRun single-axis timeline", role: "list", width: 920, height: 288, layout: "vertical", fill: F(T.bg) });
  STAGING_EVENTS.forEach((event, index) => {
    const height = event.state === "current" ? 176 : 56;
    const row = frame(timeline, { name: `DeploymentRun timeline item: ${event.title} — ${event.state}`, role: "list-item", width: "fill_container", height, layout: "horizontal", gap: 12, alignItems: "start" });
    timelineMarker(row, event.state, height, index);
    if (event.state !== "current") {
      const copy = frame(row, { width: "fill_container", height: 56, layout: "vertical", gap: 2, justifyContent: "center" });
      text(copy, event.title, { fontSize: 14, fontWeight: 500, fill: F(event.state === "future" ? T.faint : T.ink), lineHeight: 1.43 });
      text(copy, `${event.detail} · ${event.metadata}`, { fontSize: 12, fill: F(event.state === "future" ? T.faint : T.muted), lineHeight: 1.5 });
      return;
    }
    const expanded = frame(row, { name: "Current DeploymentRun expanded content", width: "fill_container", height: 160, layout: "vertical", padding: [12, 14], gap: 8, cornerRadius: 6, fill: F(T.surface), stroke: S(T.lineStrong) });
    const heading = frame(expanded, { width: "fill_container", height: 22, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
    text(heading, event.title, { fontSize: 14, fontWeight: 600, fill: F(T.ink), lineHeight: 1.43 });
    text(heading, event.metadata, { fontFamily: "Roboto Mono", fontSize: 12, fontWeight: 500, fill: F(T.blue) });
    text(expanded, event.detail, { fontSize: 12, fill: F(T.muted), lineHeight: 1.5 });
    const actions = frame(expanded, { width: "fill_container", height: 40, layout: "horizontal", gap: 10, alignItems: "center" });
    timelineButton(actions, "查看运行详情");
    timelineButton(actions, "查看终态日志", true);
    text(actions, "运行完成后开放", { fontSize: 12, fill: F(T.faint) });
  });
}

function buildStagingDeploymentRunning() {
  const { content } = createProjectMoment("V2-06 Staging Deployment Running", 7600, { tab: "发布" });
  momentHeading(content, {
    title: "Picshare R1 · 预发部署",
    status: "进行中",
    tone: "blue",
    description: "已冻结的预发部署计划正在执行，完成后写入技术结果与受控日志。",
  });
  releaseArrowProgress(content, [["构建", "completed"], ["预发部署", "current"], ["预发验证", "disabled"], ["生产发布", "disabled"]]);
  releaseFacts(content, [
    ["候选版本", `${CANDIDATE_RELEASE.name} ${CANDIDATE_RELEASE.version}`],
    ["来源", CANDIDATE_RELEASE.source],
    ["制品", CANDIDATE_RELEASE.artifact],
    ["开始时间", "2026-08-26 10:49"],
  ]);
  const lower = frame(content, { width: "fill_container", height: "fill_container", layout: "vertical", padding: [4, 0, 0, 0] });
  const events = frame(lower, { width: 920, height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(events, "执行进度", "DeploymentRun");
  stagingEventsTimeline(events);
}
