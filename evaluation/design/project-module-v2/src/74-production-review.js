function releaseComparison(parent) {
  const table = frame(parent, { name: "Current and candidate comparison", role: "table", width: "fill_container", height: 270, layout: "vertical", clipContent: true, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const widths = [150, 230, 330];
  const head = frame(table, { role: "table-header", width: "fill_container", height: 46, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.surface) });
  ["核对项", "当前生产", "候选发布"].forEach((label, index) => cell(head, widths[index], label, { fontSize: 12, fontWeight: 600, color: T.muted }));
  const rows = [
    ["版本", "图库重构 1.4.0", "图片压缩 1.5.0"],
    ["来源", "master @ a1b2c3d", "master @ b7c9e21"],
    ["图片处理", "原图直接输出", "启用压缩与质量阈值 82"],
    ["制品", "picshare-web · 84.7 MB", "picshare-web · 86.4 MB"],
  ];
  for (const values of rows) {
    const row = frame(table, { role: "table-row", width: "fill_container", height: 56, layout: "horizontal", padding: [0, 14], alignItems: "center", fill: F(T.bg), stroke: S(T.line) });
    cell(row, widths[0], values[0], { fontSize: 13, fontWeight: 600, color: T.ink });
    cell(row, widths[1], values[1], { fontSize: 13, color: T.muted });
    cell(row, widths[2], values[2], { fontSize: 13, fontWeight: 600, color: T.body });
  }
}

function approvalRequirements(parent) {
  const panel = frame(parent, { name: "Production approval requirements", width: "fill_container", height: 290, layout: "vertical", padding: 16, gap: 8, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(panel, "提交前要求", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  checkLine(panel, "circle-check", "预发验证通过", "预发入口探测与制品完整性检查通过");
  checkLine(panel, "circle-check", "生产入口已配置", "picshare.test-org.com · 10:44 完成");
  checkLine(panel, "circle-check", "影响说明已确认", "图片会压缩，原始文件继续保留");
  checkLine(panel, "shield-check", "生产审批策略", "提交后创建待审批记录，由具备权限的成员处理", "blue");
}

function buildProductionReleaseReview() {
  const { content } = createProjectMoment("V2-07 Production Release Review", 9120, { tab: "发布" });
  momentHeading(content, {
    title: "Picshare R1 · 生产核对",
    status: "待提交",
    tone: "blue",
    description: "确认当前生产与候选发布的差异、影响和审批要求。",
    primary: "提交生产审批",
    primaryIcon: "send",
  });
  releaseProgress(content, [["构建", "completed"], ["预发验证", "completed"], ["生产核对", "current"], ["等待审批", "pending"]]);
  releaseFacts(content, [
    ["当前生产", `${CURRENT_RELEASE.name} ${CURRENT_RELEASE.version}`],
    ["候选发布", `${CANDIDATE_RELEASE.name} ${CANDIDATE_RELEASE.version}`],
    ["候选来源", CANDIDATE_RELEASE.source],
    ["生产入口", "picshare.test-org.com", T.green],
  ]);
  const notice = frame(content, { name: "Review state boundary", width: "fill_container", height: 58, layout: "horizontal", padding: [0, 14], gap: 10, alignItems: "center", cornerRadius: 7, fill: F(T.blue50), stroke: S(T.blue100) });
  icon(notice, "info", { width: 18, height: 18, fill: F(T.blue) });
  const noticeCopy = frame(notice, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 2 });
  text(noticeCopy, "预发验证只提供本次核对证据", { fontSize: 13, fontWeight: 700, fill: F(T.ink) });
  text(noticeCopy, "尚未开始生产部署，当前生产仍为 1.4.0。", { fontSize: 12, fill: F(T.body) });
  const lower = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 18, padding: [4, 0, 0, 0] });
  const comparison = frame(lower, { width: 742, height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(comparison, "版本差异", "4 项变更");
  releaseComparison(comparison);
  const requirements = frame(lower, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(requirements, "影响与审批", "提交后由责任人审批");
  approvalRequirements(requirements);
}
