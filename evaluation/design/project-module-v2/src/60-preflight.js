const PREFLIGHT_CHECKS = [
  { id: "D14", check: "DNS 记录与域名归属", result: "不可用", detail: "缺少 Production DNS 真实探测证据", tone: "red", selected: true },
  { id: "D15", check: "TLS 证书与密钥引用", result: "不可用", detail: "缺少 Production TLS 真实探测证据", tone: "red" },
  { id: "D13", check: "审批、变更窗口与冻结期", result: "待后续审批", detail: "生产审批将在预检通过后创建", tone: "orange" },
  { id: "D08", check: "数据库与中间件连通", result: "已通过", detail: "资源引用均有真实连接探测", tone: "green" },
];

function preflightChecksTable(parent) {
  const table = frame(parent, { name: "Production preflight checks", role: "table", width: "fill_container", height: 270, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [240, 120, 314, 98];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.surface) });
  ["检查项", "结果", "检查说明", "操作"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  for (const check of PREFLIGHT_CHECKS) {
    const color = check.tone === "red" ? T.red : check.tone === "orange" ? T.orange : T.green;
    const glyph = check.tone === "red" ? "circle-x" : check.tone === "orange" ? "clock-3" : "circle-check";
    const row = frame(table, { name: `Check ${check.id}${check.selected ? " — selected" : ""}`, role: "table-row", width: "fill_container", height: 56, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(check.selected ? T.red50 : T.bg), stroke: S(T.line) });
    const checkCell = cell(row, widths[0]);
    icon(checkCell, glyph, { width: 17, height: 17, fill: F(color) });
    text(checkCell, `${check.id}  ${check.check}`, { fontSize: 13, fontWeight: 600, fill: F(T.ink) });
    const resultCell = cell(row, widths[1]);
    text(resultCell, check.result, { fontSize: 13, fontWeight: 600, fill: F(color) });
    cell(row, widths[2], check.detail, { fontSize: 13, color: check.tone === "green" ? T.muted : T.body });
    textAction(cell(row, widths[3]), check.tone === "red" ? "查看证据" : "详情");
  }
}

function evidenceField(parent, label, value, options = {}) {
  const row = frame(parent, { width: "fill_container", height: options.height || 34, layout: "horizontal", gap: 10, alignItems: "center", justifyContent: "space_between" });
  text(row, label, { fontSize: 12, fill: F(T.muted) });
  text(row, value, { width: options.width || 176, textGrowth: "fixed-width", textAlign: "right", fontFamily: options.mono ? "Roboto Mono" : T.font, fontSize: 12, fontWeight: 600, fill: F(options.color || T.body) });
}

function preflightEvidencePane(parent) {
  const pane = frame(parent, { name: "D14 evidence drawer", width: 330, height: "fill_container", layout: "vertical", padding: 18, gap: 14, cornerRadius: 8, fill: F(T.bg), stroke: S(T.lineStrong), effects: SHADOW });
  const title = frame(pane, { width: "fill_container", height: 32, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  const titleCopy = frame(title, { width: 220, height: "fit_content", layout: "vertical", gap: 1 });
  text(titleCopy, "D14 检查证据", { fontSize: 16, fontWeight: 700, fill: F(T.ink) });
  text(titleCopy, "DNS 记录与域名归属", { fontSize: 11, fill: F(T.muted) });
  iconAction(title, "x", "关闭证据");
  divider(pane);
  status(pane, "不可用", "red");
  const conclusion = frame(pane, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 7 });
  text(conclusion, "原因", { fontSize: 12, fontWeight: 600, fill: F(T.muted) });
  text(conclusion, "没有新鲜的 Production DNS 真实探测结果", { width: 294, textGrowth: "fixed-width", fontSize: 14, fontWeight: 600, lineHeight: 1.55, fill: F(T.ink) });
  const evidence = frame(pane, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 6, padding: 14, cornerRadius: 7, fill: F(T.surface), stroke: S(T.line) });
  text(evidence, "证据详情", { fontSize: 12, fontWeight: 600, fill: F(T.muted) });
  evidenceField(evidence, "Provider", "site_dns_tls_route", { mono: true, width: 190 });
  evidenceField(evidence, "证据", "—");
  evidenceField(evidence, "检查时间", "—");
  evidenceField(evidence, "修复目标", "生产环境 / 域名与入口", { height: 42 });
  divider(pane);
  text(pane, "修复或等待 Provider 同步后重新检查；配置、工作负载或证据变化会重新计算。", { width: 294, textGrowth: "fixed-width", fontSize: 12, lineHeight: 1.65, fill: F(T.muted) });
}

function preflightIssue(parent) {
  const blocker = frame(parent, { name: "Blocking evidence and retry action", width: "fill_container", height: 76, layout: "horizontal", padding: [0, 14], gap: 12, alignItems: "center", justifyContent: "space_between", cornerRadius: 7, fill: F(T.red50), stroke: S("#FECDD3") });
  const message = frame(blocker, { width: 724, height: "fit_content", layout: "horizontal", gap: 11, alignItems: "center" });
  icon(message, "circle-alert", { width: 19, height: 19, fill: F(T.red) });
  const copy = frame(message, { width: 690, height: "fit_content", layout: "vertical", gap: 4 });
  text(copy, "生产入口缺少新鲜的 DNS/TLS 真实探测证据", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  text(copy, "影响：2 项预审批门禁阻断，当前不能创建生产审批。", { fontSize: 13, fill: F(T.body) });
  const actions = frame(blocker, { width: 350, height: 44, layout: "horizontal", gap: 10, alignItems: "center", justifyContent: "end" });
  textAction(actions, "查看生产入口");
  button(actions, "重新检查生产预检", { kind: "primary", icon: "refresh-cw", width: 188 });
}

function buildProductionPreflight() {
  const { content } = createProjectMoment("V2-03 Production Preflight Blocked", 3040, { tab: "发布" });
  momentHeading(content, {
    title: "Picshare R1 · 生产预检",
    status: "2 项阻断",
    tone: "red",
    description: "同一 Manifest 已完成 Staging DeploymentRun；全部预审批门禁通过后才能创建生产审批。",
    meta: "2026-08-26 10:52",
  });
  releaseProgress(content, [["构建", "completed"], ["预发部署", "completed"], ["生产预检", "blocked"], ["生产审批", "disabled"]]);
  preflightIssue(content);
  const lower = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 18, padding: [4, 0, 0, 0] });
  const left = frame(lower, { width: 800, height: "fill_container", layout: "vertical", gap: 10 });
  releaseFacts(left, [
    ["当前生产", "图库重构 1.4.0"],
    ["候选版本", "图片压缩 1.5.0"],
    ["来源", "master @ b7c9e21"],
    ["制品", "picshare-web · 86.4 MB"],
  ], { name: "Preflight release facts", height: 86 });
  const checksHeading = frame(left, { width: "fill_container", height: 34, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(checksHeading, "关键预检项", { fontSize: 15, fontWeight: 700, fill: F(T.ink) });
  const checksMeta = frame(checksHeading, { width: "fit_content", height: 34, layout: "horizontal", gap: 8, alignItems: "center" });
  text(checksMeta, "16 项通过 · 2 项阻断 · 1 项待后续审批", { fontSize: 12, fill: F(T.muted) });
  textAction(checksMeta, "查看全部 19 项");
  preflightChecksTable(left);
  const concurrency = frame(left, { name: "Production concurrency", width: "fill_container", height: 44, layout: "horizontal", padding: [0, 14], alignItems: "center", justifyContent: "space_between", cornerRadius: 7, fill: F(T.surface), stroke: S(T.line) });
  text(concurrency, "生产并发", { fontSize: 13, fontWeight: 600, fill: F(T.ink) });
  text(concurrency, "可用 · 限制 1 个活动生产运行", { fontSize: 13, fontWeight: 600, fill: F(T.green) });
  preflightEvidencePane(lower);
}
