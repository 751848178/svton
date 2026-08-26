function pendingApprovalSummary(parent) {
  const panel = frame(parent, { name: "Pending production approval summary", width: "fill_container", height: 320, layout: "vertical", padding: 16, gap: 12, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  const head = frame(panel, { width: "fill_container", height: 34, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
  text(head, "审批申请", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  status(head, "等待审批", "orange");
  const rows = [
    ["提交人", "SY"],
    ["提交时间", "2026-08-26 11:04"],
    ["候选版本", "图片压缩 1.5.0"],
    ["候选来源", "master @ b7c9e21"],
    ["候选制品", "picshare-web · 86.4 MB"],
  ];
  for (const [label, value] of rows) {
    const row = frame(panel, { width: "fill_container", height: 30, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
    text(row, label, { fontSize: 12, fill: F(T.muted) });
    text(row, value, { fontSize: 12, fontWeight: 600, fill: F(T.body) });
  }
  divider(panel);
  const risk = frame(panel, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 4 });
  text(risk, "风险摘要", { fontSize: 12, fontWeight: 600, fill: F(T.muted) });
  text(risk, "图片输出将启用压缩与质量阈值 82；原始文件继续保留。", { fontSize: 13, fill: F(T.body) });
}

function pendingApprovalResponsibility(parent) {
  const panel = frame(parent, { name: "Pending approval responsibility", width: "fill_container", height: 320, layout: "vertical", padding: 16, gap: 14, cornerRadius: 7, fill: F(T.bg), stroke: S(T.lineStrong) });
  text(panel, "审批责任与状态", { fontSize: 14, fontWeight: 700, fill: F(T.ink) });
  const owner = frame(panel, { width: "fill_container", height: 64, layout: "horizontal", gap: 10, alignItems: "center", padding: [0, 10], cornerRadius: 7, fill: F(T.surface) });
  const avatar = frame(owner, { width: 36, height: 36, layout: "horizontal", alignItems: "center", justifyContent: "center", cornerRadius: 18, fill: F(T.blue100) });
  icon(avatar, "shield-check", { width: 17, height: 17, fill: F(T.blue700) });
  const ownerCopy = frame(owner, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 2 });
  text(ownerCopy, "等待有权限的生产审批人", { fontSize: 13, fontWeight: 700, fill: F(T.ink) });
  text(ownerCopy, "当前尚未指定审批人", { fontSize: 12, fill: F(T.muted) });
  for (const [label, value, tone] of [["审批状态", "等待审批", T.orange], ["当前生产", "图库重构 1.4.0", T.body], ["生产部署", "尚未创建", T.muted]]) {
    const row = frame(panel, { width: "fill_container", height: 36, layout: "horizontal", alignItems: "center", justifyContent: "space_between" });
    text(row, label, { fontSize: 12, fill: F(T.muted) });
    text(row, value, { fontSize: 12, fontWeight: 600, fill: F(tone) });
  }
  divider(panel);
  textAction(panel, "查看审批详情", { arrow: true });
}

function buildAwaitingApproval() {
  const { content } = createProjectMoment("V2-08 Awaiting Approval", 10640, { tab: "发布" });
  momentHeading(content, {
    title: "Picshare R1 · 生产审批",
    status: "等待审批",
    tone: "orange",
    description: "申请已提交，审批完成前不会开始生产部署。",
    meta: "提交于  2026-08-26 11:04",
  });
  releaseProgress(content, [["构建", "done"], ["预发验证", "done"], ["生产核对", "done"], ["等待审批", "active"]]);
  releaseFacts(content, [
    ["候选版本", `${CANDIDATE_RELEASE.name} ${CANDIDATE_RELEASE.version}`],
    ["候选来源", CANDIDATE_RELEASE.source],
    ["候选制品", CANDIDATE_RELEASE.artifact],
    ["审批状态", "等待审批", T.orange],
  ]);
  const pending = frame(content, { name: "Pending approval boundary", width: "fill_container", height: 58, layout: "horizontal", padding: [0, 14], gap: 10, alignItems: "center", cornerRadius: 7, fill: F(T.orange50), stroke: S("#FED7AA") });
  icon(pending, "clock-3", { width: 18, height: 18, fill: F(T.orange) });
  const pendingCopy = frame(pending, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 2 });
  text(pendingCopy, "等待生产审批决定", { fontSize: 13, fontWeight: 700, fill: F(T.ink) });
  text(pendingCopy, "生产部署尚未创建，当前生产仍为图库重构 1.4.0；无需再次提交。", { fontSize: 12, fill: F(T.body) });
  const lower = frame(content, { width: "fill_container", height: "fill_container", layout: "horizontal", gap: 18, padding: [4, 0, 0, 0] });
  const request = frame(lower, { width: 758, height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(request, "审批摘要", "请求已创建");
  pendingApprovalSummary(request);
  const responsibility = frame(lower, { width: "fill_container", height: "fit_content", layout: "vertical", gap: 8 });
  sectionHeading(responsibility, "责任与等待", "当前状态");
  pendingApprovalResponsibility(responsibility);
}
