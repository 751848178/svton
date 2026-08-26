const SUCCESS_EVIDENCE = [
  ["生产审批", "已通过", "Lin 于 11:24 作出批准决定", "11:24:18"],
  ["入口探测", "已通过", "picshare.test-org.com 返回 200", "11:31:20"],
  ["生产部署", "已完成", "执行器确认完成", "11:31:44"],
  ["环境版本", "当前", "图片压缩 1.5.0 已设为当前版本", "11:31:47"],
];

function successEvidenceTable(parent) {
  const table = frame(parent, { name: "Production completion evidence", role: "table", width: "fill_container", height: 270, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [160, 112, 358, 100];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.surface) });
  ["证据", "结果", "记录", "时间"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  for (const item of SUCCESS_EVIDENCE) {
    const row = frame(table, { role: "table-row", width: "fill_container", height: 56, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.bg), stroke: S(T.line) });
    const nameCell = cell(row, widths[0]);
    icon(nameCell, "circle-check", { width: 16, height: 16, fill: F(T.green) });
    text(nameCell, item[0], { fontSize: 13, fontWeight: 600, fill: F(T.ink) });
    cell(row, widths[1], item[1], { fontSize: 13, fontWeight: 600, color: T.green });
    cell(row, widths[2], item[2], { fontSize: 12, color: T.body });
    cell(row, widths[3], item[3], { fontSize: 12, color: T.muted });
  }
}

function productionCompletionRecord(parent) {
  const panel = frame(parent, { name: "Production completion record", width: "fill_container", height: 320, layout: "vertical", padding: 16, gap: 10, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(panel, "生产记录", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  const facts = [
    ["审批决定", "Lin · 11:24 通过"],
    ["生产部署", "11:25:08 – 11:31:44"],
    ["环境版本", "图片压缩 1.5.0 · 当前"],
    ["制品摘要", "sha256:9d27…8c41"],
    ["入口探测", "200 · 11:31:20"],
  ];
  for (const [label, value] of facts) {
    const row = frame(panel, { width: "fill_container", height: 34, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
    text(row, label, { fontSize: 12, fill: F(T.muted) });
    text(row, value, { fontSize: 12, fontWeight: 600, fill: F(label === "环境版本" ? T.green : T.body) });
  }
  divider(panel);
  textAction(panel, "查看部署证据", { arrow: true });
}

function drawProductionSuccess(main) {
  const content = frame(main, { name: "Production success content", width: "fill_container", height: "fill_container", layout: "vertical", padding: [20, 28], gap: 10 });
  projectTitle(content);
  projectTabs(content, "发布");
  momentHeading(content, {
    title: "Picshare R1 · 生产发布",
    status: "已完成",
    tone: "green",
    description: "生产部署完成，环境版本已更新为图片压缩 1.5.0。",
    primary: "打开生产站点",
    primaryIcon: "external-link",
  });
  releaseProgress(content, [["构建", "completed"], ["预发验证", "completed"], ["生产部署", "completed"], ["入口探测", "completed"]]);
  const success = frame(content, { name: "Production success message", width: "fill_container", height: 62, layout: "horizontal", padding: [0, 14], gap: 10, alignItems: "center", cornerRadius: 7, fill: F(T.green50), stroke: S("#BBF7D0") });
  icon(success, "circle-check", { width: 19, height: 19, fill: F(T.green) });
  const successCopy = frame(success, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 2 });
  text(successCopy, "生产环境已更新为 1.5.0", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  text(successCopy, "生产部署已完成，公开入口探测返回 200。", { fontSize: 12, fill: F(T.body) });
  releaseFacts(content, [
    ["环境版本", `${CANDIDATE_RELEASE.name} ${CANDIDATE_RELEASE.version} · 当前`, T.green],
    ["来源", CANDIDATE_RELEASE.source],
    ["生产入口", "picshare.test-org.com"],
    ["完成时间", "2026-08-26 11:31:47"],
  ]);
  const lower = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 18, padding: [4, 0, 0, 0] });
  const evidence = frame(lower, { width: 758, height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(evidence, "完成证据", "审批 → 部署 → 环境版本");
  successEvidenceTable(evidence);
  const record = frame(lower, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(record, "生产结果", "审批后创建");
  productionCompletionRecord(record);
  return content;
}

function buildProductionSuccess() {
  const { main } = createScreen("V2-09 Production Success", 12160);
  drawProductionSuccess(main);
}
