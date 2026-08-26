const PREFLIGHT_CHECKS = [
  { check: "生产入口", result: "未通过", detail: "Production 尚未绑定公开入口", tone: "red" },
  { check: "制品完整性", result: "已通过", detail: "签名与内容校验一致", tone: "green" },
  { check: "发布审批", result: "已通过", detail: "生产发布审批已完成", tone: "green" },
  { check: "并发策略", result: "已通过", detail: "当前没有冲突的生产发布", tone: "green" },
];

function stageChain(parent) {
  const chain = frame(parent, { name: "Release stages", width: "fill_container", height: 46, layout: "horizontal", gap: 0, alignItems: "center", fill: F(T.bg), stroke: S(T.lineStrong), cornerRadius: 7, clipContent: true });
  const stages = [["构建", "check", T.green, T.green50], ["预发验证", "check", T.green, T.green50], ["生产预检", "circle-alert", T.red, T.red50], ["生产部署", "clock-3", T.faint, T.shell]];
  stages.forEach(([label, glyph, color, bg], index) => {
    const item = frame(chain, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 8, alignItems: "center", justifyContent: "center", fill: F(bg), stroke: index < stages.length - 1 ? S(T.line) : undefined });
    icon(item, glyph, { width: 16, height: 16, fill: F(color) });
    text(item, label, { fontSize: 13, fontWeight: 600, fill: F(color) });
  });
}

function artifactSummary(parent) {
  const summary = frame(parent, { name: "Release summary", width: "fill_container", height: 92, layout: "horizontal", padding: [14, 16], gap: 0, alignItems: "center", cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const fields = [["当前版本", "图库重构 1.4.0"], ["候选制品", "picshare-web · 86.4 MB"], ["来源", "master @ a1b2c3d"], ["预发验证", "已通过"]];
  fields.forEach(([label, value], index) => {
    const item = frame(summary, { width: "fill_container", height: "fill_container", layout: "vertical", gap: 8, justifyContent: "center", padding: index === 0 ? [0, 10, 0, 0] : [0, 10, 0, 16], stroke: index === 0 ? undefined : S(T.line) });
    text(item, label, { fontSize: 12, fontWeight: 500, fill: F(T.muted) });
    if (index === 3) {
      const passed = frame(item, { width: "fit_content", height: 22, layout: "horizontal", gap: 6, alignItems: "center" });
      icon(passed, "circle-check", { width: 15, height: 15, fill: F(T.green) });
      text(passed, value, { fontSize: 13, fontWeight: 600, fill: F(T.green) });
    } else text(item, value, { fontSize: 13, fontWeight: 600, fill: F(T.ink) });
  });
}

function checksTable(parent) {
  const table = frame(parent, { name: "Production preflight checks", role: "table", width: "fill_container", height: 270, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [176, 118, 370, 90];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.surface) });
  ["检查项", "结果", "检查说明", "操作"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  for (const check of PREFLIGHT_CHECKS) {
    const failed = check.tone === "red";
    const row = frame(table, { name: `Check: ${check.check}${failed ? " — selected" : ""}`, role: "table-row", width: "fill_container", height: 56, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(failed ? T.red50 : T.bg), stroke: S(T.line) });
    const checkCell = cell(row, widths[0]);
    icon(checkCell, failed ? "circle-x" : "circle-check", { width: 17, height: 17, fill: F(failed ? T.red : T.green) });
    text(checkCell, check.check, { fontSize: 13, fontWeight: 600, fill: F(T.ink) });
    const resultCell = cell(row, widths[1]);
    text(resultCell, check.result, { fontSize: 13, fontWeight: 600, fill: F(failed ? T.red : T.green) });
    cell(row, widths[2], check.detail, { fontSize: 13, color: failed ? T.body : T.muted });
    const action = cell(row, widths[3]);
    textAction(action, failed ? "查看证据" : "详情");
  }
}

function evidencePane(parent) {
  const pane = frame(parent, { name: "Evidence drawer", width: 310, height: "fill_container", layout: "vertical", padding: 18, gap: 16, cornerRadius: 8, fill: F(T.bg), stroke: S(T.lineStrong), effects: SHADOW });
  const title = frame(pane, { width: "fill_container", height: 32, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(title, "检查证据", { fontSize: 16, fontWeight: 700, fill: F(T.ink) });
  iconAction(title, "x", "关闭证据");
  divider(pane);
  status(pane, "生产入口未通过", "red");
  const summary = frame(pane, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 7 });
  text(summary, "检查结论", { fontSize: 12, fontWeight: 600, fill: F(T.muted) });
  text(summary, "生产环境没有可接收外部流量的入口，当前版本不能继续部署。", { width: 274, textGrowth: "fixed-width", fontSize: 14, fontWeight: 500, lineHeight: 1.6, fill: F(T.ink) });
  const evidence = frame(pane, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 10, padding: 14, cornerRadius: 7, fill: F(T.surface), stroke: S(T.line) });
  text(evidence, "检测结果", { fontSize: 12, fontWeight: 600, fill: F(T.muted) });
  for (const [label, value] of [["环境", "生产环境"], ["目标组件", "picshare-web"], ["当前入口", "未配置"], ["最近检查", "2026-08-26 10:42"]]) {
    const item = frame(evidence, { width: "fill_container", height: 28, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
    text(item, label, { fontSize: 12, fill: F(T.muted) });
    text(item, value, { fontSize: 12, fontWeight: 600, fill: F(value === "未配置" ? T.red : T.body) });
  }
  divider(pane);
  text(pane, "完成配置后返回本页重新检查；已通过的制品、审批和并发检查会保留。", { width: 274, textGrowth: "fixed-width", fontSize: 12, lineHeight: 1.65, fill: F(T.muted) });
}

function buildProductionPreflight() {
  const { main } = createScreen("V2-03 Production Preflight Blocked", 3040);
  const content = frame(main, { width: "fill_container", height: "fill_container", layout: "vertical", padding: [20, 28], gap: 10 });
  projectTitle(content);
  projectTabs(content, "发布");
  const releaseHead = frame(content, { width: "fill_container", height: 58, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const heading = frame(releaseHead, { width: 640, height: "fit_content", layout: "vertical", gap: 4 });
  const headingLine = frame(heading, { width: "fit_content", height: 30, layout: "horizontal", gap: 10, alignItems: "center" });
  text(headingLine, "Picshare R1 · 生产预检", { fontSize: 22, fontWeight: 700, fill: F(T.ink) });
  status(headingLine, "已阻断", "red");
  text(heading, "预发验证已完成，生产部署将在全部预检通过后开始。", { fontSize: 13, fill: F(T.muted) });
  text(releaseHead, "最近检查  2026-08-26 10:42", { fontSize: 12, fill: F(T.muted) });
  stageChain(content);
  const blocker = frame(content, { name: "Blocking issue and repair action", width: "fill_container", height: 70, layout: "horizontal", padding: [0, 14], gap: 12, alignItems: "center", justifyContent: "space_between", cornerRadius: 7, fill: F(T.red50), stroke: S("#FECDD3") });
  const message = frame(blocker, { width: 810, height: "fit_content", layout: "horizontal", gap: 11, alignItems: "center" });
  icon(message, "circle-alert", { width: 19, height: 19, fill: F(T.red) });
  const copy = frame(message, { width: 760, height: "fit_content", layout: "vertical", gap: 4 });
  text(copy, "生产环境缺少公开入口", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  text(copy, "影响：外部流量无法访问 picshare-web，本次生产部署不能继续。", { fontSize: 13, fill: F(T.body) });
  button(blocker, "配置生产入口", { kind: "primary", icon: "external-link", width: 156 });
  const lower = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 18, padding: [4, 0, 0, 0] });
  const left = frame(lower, { width: 778, height: "fill_container", layout: "vertical", gap: 12 });
  artifactSummary(left);
  const checksTitle = frame(left, { width: "fill_container", height: 32, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(checksTitle, "生产预检", { fontSize: 15, fontWeight: 700, fill: F(T.ink) });
  text(checksTitle, "3 项通过 · 1 项未通过", { fontSize: 12, fontWeight: 500, fill: F(T.red) });
  checksTable(left);
  evidencePane(lower);
}
